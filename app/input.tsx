import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useState, useCallback, useEffect } from 'react';
import {
	ScrollView,
	StyleSheet,
	View,
	TouchableOpacity,
	FlatList,
} from 'react-native';
import {
	Button,
	Card,
	Checkbox,
	IconButton,
	Text,
	TextInput,
	Modal,
	Portal,
	useTheme,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedFamily {
	id: number;
	name: string;
	members: { id: number; name: string }[];
}

interface FamilyInBill {
	id: number;
	name: string;
	lines: string;
	extraService: { hasService: boolean; cost: string };
}

const formatBillMonth = (date: Date | undefined) => {
	if (!date) return '';
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	return `${year}年 ${month}月`;
};

const parseBillMonth = (monthString: string): Date => {
	const [yearPart, monthPart] = monthString.split(' ');
	const year = parseInt(yearPart.replace('年', ''), 10);
	const month = parseInt(monthPart.replace('月', ''), 10) - 1; // Month is 0-indexed
	return new Date(year, month);
};

export default function InputScreen() {
	const router = useRouter();
	const params = useLocalSearchParams();
	const theme = useTheme();

	const [totalCost, setTotalCost] = useState('');
	const [familiesInBill, setFamiliesInBill] = useState<FamilyInBill[]>([]);
	const [billDate, setBillDate] = useState<Date | undefined>(new Date());
	const [editingBillId, setEditingBillId] = useState<number | null>(null);
	const [allSavedFamilies, setAllSavedFamilies] = useState<SavedFamily[]>([]);
	const [isFamilyPickerVisible, setFamilyPickerVisible] = useState(false);
	const [isDatePickerVisible, setDatePickerVisible] = useState(false);

	useFocusEffect(
		useCallback(() => {
			const loadFamilies = async () => {
				const familiesJson = await AsyncStorage.getItem('families');
				setAllSavedFamilies(familiesJson ? JSON.parse(familiesJson) : []);
			};
			loadFamilies();
		}, [])
	);

	useEffect(() => {
		if (params.billToModify) {
			const data = JSON.parse(params.billToModify as string);
			setEditingBillId(data.id);
			setTotalCost(data.totalCost.toString());
			setBillDate(parseBillMonth(data.billMonth));
			const familiesWithStringValues = data.families.map((f: any) => ({
				...f,
				lines: f.lines.toString(),
				extraService: {
					...f.extraService,
					cost: f.extraService.cost.toString(),
				},
			}));
			setFamiliesInBill(familiesWithStringValues);
		} else if (params.duplicatedData) {
			const data = JSON.parse(params.duplicatedData as string);
			setEditingBillId(null);
			setTotalCost(data.totalCost.toString());
			const familiesWithStringValues = data.families.map((f: any) => ({
				...f,
				lines: f.lines.toString(),
				extraService: {
					...f.extraService,
					cost: f.extraService.cost.toString(),
				}
			}));
			setFamiliesInBill(familiesWithStringValues);
		}
	}, [params.billToModify, params.duplicatedData]);

	const onDismissDatePicker = useCallback(() => setDatePickerVisible(false), []);
	const onConfirmDatePicker = useCallback((params: { date: Date | undefined }) => {
		setDatePickerVisible(false);
		setBillDate(params.date);
	}, []);

	const handleSelectFamily = (family: SavedFamily) => {
		if (familiesInBill.some(f => f.id === family.id)) {
			return;
		}
		const newFamilyForBill: FamilyInBill = {
			id: family.id,
			name: family.name,
			lines: family.members.length.toString(),
			extraService: { hasService: false, cost: '' },
		};
		setFamiliesInBill([...familiesInBill, newFamilyForBill]);
		setFamilyPickerVisible(false);
	};

	const removeFamilyFromBill = (id: number) => {
		setFamiliesInBill(familiesInBill.filter(family => family.id !== id));
	};

	const updateFamilyExtraService = (id: number, field: 'hasService' | 'cost', value: any) => {
		setFamiliesInBill(
			familiesInBill.map(family => {
				if (family.id === id) {
					return {
						...family,
						extraService: { ...family.extraService, [field]: value },
					};
				}
				return family;
			})
		);
	};

	const handleCalculate = () => {
		const parsedTotalCost = parseFloat(totalCost) || 0;
		let totalExtraServiceCost = 0;
		let totalLines = 0;

		const familiesWithParsedNumbers = familiesInBill.map(family => {
			const lines = parseInt(family.lines, 10) || 0;
			const extraCost = family.extraService.hasService ? parseFloat(family.extraService.cost) || 0 : 0;
			totalExtraServiceCost += extraCost;
			totalLines += lines;
			return {
				id: family.id,
				name: family.name,
				lines: lines,
				extraService: { hasService: family.extraService.hasService, cost: extraCost },
			};
		});

		const totalLineCost = parsedTotalCost - totalExtraServiceCost;
		const costPerLine = totalLines > 0 ? totalLineCost / totalLines : 0;

		const dataToPass = {
			id: editingBillId,
			billMonth: billDate ? formatBillMonth(billDate) : 'N/A',
			totalCost: parsedTotalCost,
			costPerLine: costPerLine,
			families: familiesWithParsedNumbers,
		};

		router.push({
			pathname: '/result',
			params: { data: JSON.stringify(dataToPass) },
		});
	};

	return (
		<SafeAreaProvider>
			<ScrollView style={styles.container}>
				<Portal>
					<Modal visible={isFamilyPickerVisible} onDismiss={() => setFamilyPickerVisible(false)} contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
						<Text variant="headlineSmall" style={{ marginBottom: 20 }}>选择家庭</Text>
						<FlatList
							data={allSavedFamilies}
							keyExtractor={item => item.id.toString()}
							renderItem={({ item }) => (
								<TouchableOpacity onPress={() => handleSelectFamily(item)}>
									<Card style={{ marginBottom: 8 }}>
										<Card.Title title={item.name} subtitle={`成员数: ${item.members.length}`} />
									</Card>
								</TouchableOpacity>
							)}
							ListEmptyComponent={<Text>没有找到已保存的家庭信息。</Text>}
						/>
					</Modal>
				</Portal>

				<DatePickerModal locale="zh" mode="single" visible={isDatePickerVisible} onDismiss={onDismissDatePicker} date={billDate} onConfirm={onConfirmDatePicker} />

				<Card style={styles.card}>
					<Card.Content>
						<TextInput label="账单总金额" value={totalCost} onChangeText={setTotalCost} keyboardType="numeric" mode="outlined" style={styles.inputSpacing} />
						<TouchableOpacity onPress={() => setDatePickerVisible(true)}>
							<TextInput label="账单月份" value={formatBillMonth(billDate)} mode="outlined" editable={false} right={<TextInput.Icon icon="calendar" />} />
						</TouchableOpacity>
					</Card.Content>
				</Card>

				<View style={styles.familyHeader}>
					<Text variant="titleMedium">账单包含的家庭</Text>
					<Button icon="plus-circle" mode="contained" onPress={() => setFamilyPickerVisible(true)}>
						选择家庭
					</Button>
				</View>

				{familiesInBill.map(family => (
					<Card key={family.id} style={styles.card}>
						<Card.Title
							title={family.name}
							subtitle={`线路数量: ${family.lines}`}
							right={props => <IconButton {...props} icon="delete-outline" onPress={() => removeFamilyFromBill(family.id)} />}
						/>
						<Card.Content>
							<View style={styles.checkboxContainer}>
								<Checkbox.Item
									label="有额外服务 (如Wi-Fi)?"
									status={family.extraService.hasService ? 'checked' : 'unchecked'}
									onPress={() => updateFamilyExtraService(family.id, 'hasService', !family.extraService.hasService)}
									position="leading"
									labelStyle={styles.checkboxLabel}
								/>
							</View>
							{family.extraService.hasService && (
								<TextInput
									label="额外服务金额"
									value={family.extraService.cost}
									onChangeText={text => updateFamilyExtraService(family.id, 'cost', text)}
									keyboardType="numeric"
									mode="outlined"
								/>
							)}
						</Card.Content>
					</Card>
				))}

				<Button
					mode="contained-tonal"
					onPress={handleCalculate}
					style={styles.calculateButton}
					contentStyle={styles.buttonContent}
					labelStyle={styles.buttonLabel}
					disabled={!totalCost || familiesInBill.length === 0}
				>
					计算费用
				</Button>
			</ScrollView>
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 8,
	},
	card: {
		marginBottom: 16,
	},
	familyHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 8,
		marginBottom: 16,
	},
	checkboxContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: -10,
		marginTop: 8,
	},
	checkboxLabel: {
		textAlign: 'left',
	},
	inputSpacing: {
		marginBottom: 12,
	},
	calculateButton: {
		marginTop: 16,
		marginBottom: 32,
		marginHorizontal: 8,
	},
	buttonContent: {
		paddingVertical: 8,
	},
	buttonLabel: {
		fontSize: 16,
	},
	modalContainer: {
		padding: 20,
		margin: 20,
		borderRadius: 8,
	},
});
