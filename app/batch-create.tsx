import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
	View,
	StyleSheet,
	Alert,
	ScrollView,
	TouchableOpacity,
} from 'react-native';
import {
	Button,
	Card,
	TextInput,
	useTheme,
	Checkbox,
	ActivityIndicator,
	Divider,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatePickerModal } from 'react-native-paper-dates';
import { SafeAreaProvider } from 'react-native-safe-area-context';

interface FamilyData {
	id: number;
	name: string;
	members: any[];
}
interface BillData {
	id: number;
	billMonth: string;
	totalCost: number;
	costPerLine: number;
	families: any[];
}

const formatBillMonth = (date: Date | undefined) => {
	if (!date) return '';
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	return `${year}年 ${month}月`;
};

export default function BatchCreateScreen() {
	const router = useRouter();
	const theme = useTheme();

	const [allFamilies, setAllFamilies] = useState<FamilyData[]>([]);
	const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<number>>(new Set());
	const [extraServiceCosts, setExtraServiceCosts] = useState<{ [key: number]: string }>({});
	const [totalCost, setTotalCost] = useState('');
	const [startDate, setStartDate] = useState<Date | undefined>();
	const [endDate, setEndDate] = useState<Date | undefined>();
	const [isStartDatePickerVisible, setStartDatePickerVisible] = useState(false);
	const [isEndDatePickerVisible, setEndDatePickerVisible] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isCreating, setIsCreating] = useState(false);

	useFocusEffect(
		useCallback(() => {
			const loadFamilies = async () => {
				setIsLoading(true);
				try {
					const familiesJson = await AsyncStorage.getItem('families');
					setAllFamilies(familiesJson ? JSON.parse(familiesJson) : []);
				} catch (error) {
					console.error('Failed to load families:', error);
				} finally {
					setIsLoading(false);
				}
			};
			loadFamilies();
		}, [])
	);

	const toggleFamilySelection = (familyId: number) => {
		const newSelection = new Set(selectedFamilyIds);
		if (newSelection.has(familyId)) {
			newSelection.delete(familyId);
		} else {
			newSelection.add(familyId);
		}
		setSelectedFamilyIds(newSelection);
	};

	const handleExtraServiceChange = (familyId: number, cost: string) => {
		setExtraServiceCosts(prev => ({ ...prev, [familyId]: cost }));
	};

	const handleBatchCreate = async () => {
		if (selectedFamilyIds.size === 0 || !totalCost || !startDate || !endDate) {
			Alert.alert('信息不完整', '请选择至少一个家庭，并填写总金额和起止月份。');
			return;
		}
		if (endDate < startDate) {
			Alert.alert('日期错误', '结束月份不能早于开始月份。');
			return;
		}

		setIsCreating(true);

		try {
			const selectedFamilies = allFamilies.filter((f) => selectedFamilyIds.has(f.id));
			const parsedTotalCost = parseFloat(totalCost) || 0;
			let totalExtraServiceCost = 0;

			const familiesForBill = selectedFamilies.map((f) => {
				const extraCost = parseFloat(extraServiceCosts[f.id]) || 0;
				totalExtraServiceCost += extraCost;
				return {
					id: f.id,
					name: f.name,
					lines: f.members.length,
					extraService: { hasService: extraCost > 0, cost: extraCost },
				};
			});

			const totalLineCost = parsedTotalCost - totalExtraServiceCost;
			if (totalLineCost < 0) {
				Alert.alert('金额错误', '所有额外服务费用的总和不能超过账单总金额。');
				setIsCreating(false);
				return;
			}

			const totalLines = familiesForBill.reduce((sum, f) => sum + f.lines, 0);
			const costPerLine = totalLines > 0 ? totalLineCost / totalLines : 0;

			const newBills: BillData[] = [];
			let currentDate = new Date(startDate);
			while (currentDate <= endDate) {
				newBills.push({
					id: Date.now() + currentDate.getTime(),
					billMonth: formatBillMonth(currentDate) || '',
					totalCost: parsedTotalCost,
					costPerLine: costPerLine,
					families: familiesForBill,
				});
				currentDate.setMonth(currentDate.getMonth() + 1);
			}

			const existingBillsJson = await AsyncStorage.getItem('bills');
			const existingBills = existingBillsJson ? JSON.parse(existingBillsJson) : [];
			const updatedBills = [...existingBills, ...newBills];
			await AsyncStorage.setItem('bills', JSON.stringify(updatedBills));

			Alert.alert('创建成功', `已成功为您创建 ${newBills.length} 份账单。`, [
				{ text: '好的', onPress: () => router.back() },
			]);
		} catch (error) {
			console.error('Failed to batch create bills:', error);
			Alert.alert('创建失败', '发生未知错误，请稍后再试。');
		} finally {
			setIsCreating(false);
		}
	};

	if (isLoading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator animating={true} size="large" />
			</View>
		);
	}

	return (
		<SafeAreaProvider>
			<ScrollView style={styles.container}>
				<DatePickerModal
					locale="en"
					mode="single"
					visible={isStartDatePickerVisible}
					onDismiss={() => setStartDatePickerVisible(false)}
					date={startDate}
					onConfirm={(params) => {
						setStartDatePickerVisible(false);
						setStartDate(params.date);
					}}
				/>
				<DatePickerModal
					locale="en"
					mode="single"
					visible={isEndDatePickerVisible}
					onDismiss={() => setEndDatePickerVisible(false)}
					date={endDate}
					onConfirm={(params) => {
						setEndDatePickerVisible(false);
						setEndDate(params.date);
					}}
				/>

				<Card style={styles.card}>
					<Card.Title title="第一步：选择家庭并设置固定费用" />
					<Card.Content>
						{allFamilies.map((family, index) => (
							<View key={family.id}>
								<Checkbox.Item
									label={`${family.name} (${family.members.length}人)`}
									status={selectedFamilyIds.has(family.id) ? 'checked' : 'unchecked'}
									onPress={() => toggleFamilySelection(family.id)}
								/>
								{selectedFamilyIds.has(family.id) && (
									<TextInput
										label={`${family.name} 的每月固定额外费用`}
										value={extraServiceCosts[family.id] || ''}
										onChangeText={(text) => handleExtraServiceChange(family.id, text)}
										keyboardType="numeric"
										mode="outlined"
										style={styles.extraServiceInput}
									/>
								)}
								{index < allFamilies.length - 1 && <Divider style={{ marginVertical: 8 }} />}
							</View>
						))}
					</Card.Content>
				</Card>

				<Card style={styles.card}>
					<Card.Title title="第二步：设置总金额与日期" />
					<Card.Content>
						<TextInput
							label="每月账单总金额"
							value={totalCost}
							onChangeText={setTotalCost}
							keyboardType="numeric"
							mode="outlined"
							style={{ marginBottom: 16 }}
						/>
						<View style={styles.datePickerContainer}>
							<TouchableOpacity onPress={() => setStartDatePickerVisible(true)} style={{ flex: 1 }}>
								<TextInput label="开始月份" value={formatBillMonth(startDate)} mode="outlined" editable={false} />
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => setEndDatePickerVisible(true)}
								style={{ flex: 1, marginLeft: 8 }}
							>
								<TextInput label="结束月份" value={formatBillMonth(endDate)} mode="outlined" editable={false} />
							</TouchableOpacity>
						</View>
					</Card.Content>
				</Card>

				<Button
					mode="contained"
					onPress={handleBatchCreate}
					style={styles.createButton}
					contentStyle={styles.buttonContent}
					disabled={isCreating}
					loading={isCreating}
				>
					{isCreating ? '正在创建...' : '确认批量创建'}
				</Button>
			</ScrollView>
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	card: {
		marginBottom: 20,
	},
	datePickerContainer: {
		flexDirection: 'row',
	},
	createButton: {
		marginTop: 16,
		marginBottom: 32,
	},
	buttonContent: {
		paddingVertical: 8,
	},
	extraServiceInput: {
		marginTop: -8,
		marginBottom: 8,
		marginHorizontal: 16,
	},
});
