import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import React, { useState, useCallback, useContext, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import {
	FAB,
	Text,
	Card,
	ActivityIndicator,
	useTheme,
	Button,
	Modal,
	Portal,
	DataTable,
	TextInput,
	Checkbox,
	Appbar,
	IconButton,
	Divider,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatePickerModal } from 'react-native-paper-dates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ThemeContext } from './_layout';

interface BillData {
	id: number;
	billMonth: string;
	totalCost: number;
	costPerLine: number;
	families: any[];
}

interface FamilyData {
	id: number;
	name: string;
	members: any[];
}

interface SummaryResult {
	monthlyBreakdown: any;
	name: string;
	totalCost: number;
	monthlyBill: number;
	lines: number;
	extraServiceCost: number;
}

const formatBillMonth = (date: Date | undefined) => {
	if (!date) return '';
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	return `${year}年 ${month}月`;
};

const generateSummaryPdfHtml = (summaryData: SummaryResult[], dateRange: string): string => {
	const totalAmount = summaryData.reduce((sum, item) => sum + item.totalCost, 0);

	const rowsHtml = summaryData
		.map((item) => {
			const monthlyDetailsHtml = item.monthlyBreakdown
				.map(
					(breakdown: { month: any; cost: number; }) =>
						`<div class="details-text">${breakdown.month}: $${breakdown.cost.toFixed(2)}</div>`
				)
				.join('');

			return `
        <tr>
          <td>
            <div class="main-text">${item.name}</div>
            ${monthlyDetailsHtml}
          </td>
          <td class="numeric main-text">$${item.totalCost.toFixed(2)}</td>
        </tr>
      `;
		})
		.join('');

	return `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #000000; background-color: #FFFFFF; }
          .header { text-align: center; border-bottom: 2px solid #eeeeee; padding-bottom: 10px; margin-bottom: 20px; }
          .summary-card { border: 1px solid #dddddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          h1 { font-size: 24px; margin: 0; }
          h2 { font-size: 16px; font-weight: normal; color: #555555; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eeeeee; vertical-align: top; }
          th { font-weight: bold; }
          .numeric { text-align: right; }
          .main-text { font-size: 16px; font-weight: bold; }
          .details-text { font-size: 13px; color: #666666; padding-top: 6px; }
          .total-row { border-top: 2px solid #000000; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header"><h1>费用统计报告</h1><h2>${dateRange}</h2></div>
        <div class="summary-card">
          <table>
            <thead><tr><th>家庭</th><th class="numeric">期间总费用</th></tr></thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td><div class="main-text">总计</div></td>
                <td class="numeric"><div class="main-text">$${totalAmount.toFixed(2)}</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

export default function HomeScreen() {
	const router = useRouter();
	const theme = useTheme();
	const navigation = useNavigation();
	const { toggleTheme } = useContext(ThemeContext);

	const [allBills, setAllBills] = useState<BillData[]>([]);
	const [filteredBills, setFilteredBills] = useState<BillData[]>([]);
	const [allFamilies, setAllFamilies] = useState<FamilyData[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isEditMode, setIsEditMode] = useState(false);
	const [selectedBillIds, setSelectedBillIds] = useState<Set<number>>(new Set());
	const [startDate, setStartDate] = useState<Date | undefined>();
	const [endDate, setEndDate] = useState<Date | undefined>();
	const [isStartDatePickerVisible, setStartDatePickerVisible] = useState(false);
	const [isEndDatePickerVisible, setEndDatePickerVisible] = useState(false);
	const [isSummaryModalVisible, setSummaryModalVisible] = useState(false);
	const [summaryData, setSummaryData] = useState<SummaryResult[]>([]);
	const [dateRange, setDateRange] = useState('');
	const [filterVisible, setFilterVisible] = useState(false);
	const [filterFamilyId, setFilterFamilyId] = useState<number | null>(null);
	const [filterMinAmount, setFilterMinAmount] = useState('');
	const [fabOpen, setFabOpen] = useState(false);

	useFocusEffect(
		useCallback(() => {
			const loadData = async () => {
				setIsLoading(true);
				try {
					const billsJson = await AsyncStorage.getItem('bills');
					const familiesJson = await AsyncStorage.getItem('families');

					const loadedBills = billsJson ? JSON.parse(billsJson) : [];
					loadedBills.sort((a: { billMonth: any; }, b: { billMonth: string; }) => b.billMonth.localeCompare(a.billMonth));

					setAllBills(loadedBills);
					setFilteredBills(loadedBills);
					setAllFamilies(familiesJson ? JSON.parse(familiesJson) : []);
				} catch (error) {
					console.error('Failed to load data:', error);
				} finally {
					setIsLoading(false);
				}
			};
			loadData();
		}, [])
	);

	const applyFilters = useCallback(() => {
		let billsToFilter = [...allBills];

		if (filterFamilyId) {
			billsToFilter = billsToFilter.filter((bill) =>
				bill.families.some((f) => f.id === filterFamilyId)
			);
		}

		const minAmount = parseFloat(filterMinAmount);
		if (!isNaN(minAmount) && minAmount > 0) {
			billsToFilter = billsToFilter.filter((bill) => bill.totalCost >= minAmount);
		}

		setFilteredBills(billsToFilter);
	}, [allBills, filterFamilyId, filterMinAmount]);

	useEffect(() => {
		applyFilters();
	}, [applyFilters]);

	const clearFilters = () => {
		setFilterFamilyId(null);
		setFilterMinAmount('');
	};

	useEffect(() => {
		navigation.setOptions({
			title: isEditMode ? `已选择 ${selectedBillIds.size} 项` : '历史账单',
			headerRight: () => (
				<View style={{ flexDirection: 'row' }}>
					{!isEditMode && (
						<>
							<IconButton icon="filter-variant" onPress={() => setFilterVisible(!filterVisible)} />
							<IconButton icon="account-group" onPress={() => router.push('/families')} />
							<IconButton
								icon={theme.dark ? 'white-balance-sunny' : 'moon-waning-crescent'}
								onPress={toggleTheme}
							/>
						</>
					)}
					{allBills.length > 0 && (
						<IconButton icon={isEditMode ? 'close' : 'playlist-edit'} onPress={toggleEditMode} />
					)}
				</View>
			),
		});
	}, [navigation, isEditMode, selectedBillIds, allBills, theme, filterVisible]);

	const toggleEditMode = () => {
		setIsEditMode(!isEditMode);
		setSelectedBillIds(new Set());
	};

	const toggleBillSelection = (billId: number) => {
		const newSelection = new Set(selectedBillIds);
		if (newSelection.has(billId)) {
			newSelection.delete(billId);
		} else {
			newSelection.add(billId);
		}
		setSelectedBillIds(newSelection);
	};

	const handleBulkDelete = () => {
		Alert.alert('确认删除', `您确定要删除选中的 ${selectedBillIds.size} 个账单吗？`, [
			{ text: '取消', style: 'cancel' },
			{
				text: '确认删除',
				style: 'destructive',
				onPress: async () => {
					const newBills = allBills.filter((b) => !selectedBillIds.has(b.id));
					try {
						await AsyncStorage.setItem('bills', JSON.stringify(newBills));
						setAllBills(newBills);
						toggleEditMode();
					} catch (error) {
						console.error('Failed to bulk delete bills:', error);
						Alert.alert('删除失败', '无法删除账单，请稍后再试。');
					}
				},
			},
		]);
	};

	const handleLongPressBill = (bill: BillData) => {
		if (isEditMode) return;
		Alert.alert(`管理账单: ${bill.billMonth}`, '请选择您要执行的操作。', [
			{ text: '取消', style: 'cancel' },
			{ text: '删除', style: 'destructive', onPress: () => handleDeleteBill(bill) },
			{ text: '复制', onPress: () => handleDuplicateBill(bill) },
			{ text: '修改', onPress: () => handleModifyBill(bill) },
		], { cancelable: true });
	};

	const handleModifyBill = (billToModify: BillData) => {
		router.push({ pathname: '/input', params: { billToModify: JSON.stringify(billToModify) } });
	};

	const handleDuplicateBill = (billToDuplicate: BillData) => {
		const duplicatedData = { ...billToDuplicate, id: null, billMonth: null };
		router.push({ pathname: '/input', params: { duplicatedData: JSON.stringify(duplicatedData) } });
	};

	const handleDeleteBill = (billToDelete: BillData) => {
		Alert.alert('确认删除', `您确定要删除 ${billToDelete.billMonth} 的账单吗？此操作无法撤销。`, [
			{ text: '取消', style: 'cancel' },
			{
				text: '确认删除',
				style: 'destructive',
				onPress: async () => {
					const newBills = allBills.filter((b) => b.id !== billToDelete.id);
					try {
						await AsyncStorage.setItem('bills', JSON.stringify(newBills));
						setAllBills(newBills);
					} catch (error) {
						console.error('Failed to delete bill:', error);
						Alert.alert('删除失败', '无法删除账单，请稍后再试。');
					}
				},
			},
		]);
	};

	const handleCalculateSummary = () => {
		if (!startDate || !endDate || !allBills.length) {
			Alert.alert('提示', '请选择开始和结束月份，并确保有历史账单。');
			return;
		}
		const startMonthStr = formatBillMonth(startDate);
		const endMonthStr = formatBillMonth(endDate);
		const filteredBills = allBills.filter(
			(bill) => bill.billMonth >= startMonthStr && bill.billMonth <= endMonthStr
		);
		if (filteredBills.length === 0) {
			Alert.alert('无数据', '您选择的日期范围内没有账单记录。');
			return;
		}

		const summary: { [key: string]: Omit<SummaryResult, 'name'> } = {};

		filteredBills.forEach((bill) => {
			bill.families.forEach((family) => {
				const familyName = family.name || `家庭 ${family.id}`;
				const familyTotalCost = family.lines * bill.costPerLine + family.extraService.cost;

				if (!summary[familyName]) {
					summary[familyName] = {
						extraServiceCost: 0,
						lines: 0,
						monthlyBill: 0,
						totalCost: 0,
						monthlyBreakdown: []
					};
				}
				summary[familyName].totalCost += familyTotalCost;
				summary[familyName].monthlyBreakdown.push({
					month: bill.billMonth,
					cost: familyTotalCost,
				});
			});
		});

		const summaryArray: SummaryResult[] = Object.keys(summary).map((name) => ({
			name,
			...summary[name],
		}));

		setSummaryData(summaryArray);
		setDateRange(`${startMonthStr} 至 ${endMonthStr}`);
		setSummaryModalVisible(true);
	};

	const handleShareSummaryPdf = async () => {
		const html = generateSummaryPdfHtml(summaryData, dateRange);
		try {
			const { uri } = await Print.printToFileAsync({ html });
			if (Platform.OS === 'ios') {
				await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
			} else {
				await Sharing.shareAsync(uri);
			}
		} catch (error) {
			console.error('Failed to generate or share summary PDF:', error);
			Alert.alert('生成失败', '无法生成PDF报告，请稍后再试。');
		}
	};

	const renderBillItem = ({ item }: { item: BillData }) => {
		const isSelected = selectedBillIds.has(item.id);

		return (
			<TouchableOpacity
				onPress={() =>
					isEditMode
						? toggleBillSelection(item.id)
						: router.push({ pathname: '/result', params: { data: JSON.stringify(item) } })
				}
				onLongPress={() => handleLongPressBill(item)}
			>
				<Card style={styles.card}>
					<Card.Title
						title={`${item.billMonth} 账单`}
						subtitle={`总金额: $${item.totalCost.toFixed(2)}`}
						left={() => isEditMode && <Checkbox status={isSelected ? 'checked' : 'unchecked'} />}
						right={(props) => !isEditMode && <Text {...props} style={styles.cardRightText}>查看详情</Text>}
					/>
				</Card>
			</TouchableOpacity>
		);
	};

	const renderEmptyState = () => (
		<Card style={styles.card}>
			<Card.Content>
				<Text variant="titleMedium">欢迎使用话费分摊 App!</Text>
				<Text variant="bodyMedium" style={styles.emptyText}>您还没有任何账单记录。</Text>
				<Text variant="bodyMedium" style={styles.emptyText}>点击右下角的 &#39;+&#39; 按钮开始创建您的第一份账单。</Text>
			</Card.Content>
		</Card>
	);

	const FilterSection = () => (
		<View>
			{filterVisible && (
				<Card style={styles.summaryCard}>
					<Card.Content>
						<View style={styles.filterHeader}>
							<Text variant="titleMedium">筛选账单</Text>
							<Button onPress={clearFilters}>清除</Button>
						</View>
						<Divider style={{ marginVertical: 8 }} />
						<Text>按家庭筛选</Text>
						<View style={styles.chipContainer}>
							{allFamilies.map((family) => (
								<Button
									key={family.id}
									mode={filterFamilyId === family.id ? 'contained' : 'outlined'}
									onPress={() => setFilterFamilyId(filterFamilyId === family.id ? null : family.id)}
									style={styles.chip}
								>
									{family.name}
								</Button>
							))}
						</View>
						<TextInput
							label="总金额不低于"
							value={filterMinAmount}
							onChangeText={setFilterMinAmount}
							keyboardType="numeric"
							mode="outlined"
							style={{ marginTop: 16 }}
						/>
					</Card.Content>
				</Card>
			)}
		</View>
	);

	const SummarySection = () => (
		<Card style={styles.summaryCard}>
			<Card.Content>
				<Text variant="titleMedium" style={{ marginBottom: 16 }}>费用统计</Text>
				<View style={styles.datePickerContainer}>
					<TouchableOpacity onPress={() => setStartDatePickerVisible(true)} style={{ flex: 1 }}>
						<TextInput label="开始月份" value={formatBillMonth(startDate)} mode="outlined" editable={false} />
					</TouchableOpacity>
					<TouchableOpacity onPress={() => setEndDatePickerVisible(true)} style={{ flex: 1, marginLeft: 8 }}>
						<TextInput label="结束月份" value={formatBillMonth(endDate)} mode="outlined" editable={false} />
					</TouchableOpacity>
				</View>
				<Button mode="contained" onPress={handleCalculateSummary} style={{ marginTop: 16 }}>
					统计总费用
				</Button>
			</Card.Content>
		</Card>
	);

	if (isLoading) {
		return (
			<View style={[styles.container, styles.center]}>
				<ActivityIndicator animating={true} size="large" />
			</View>
		);
	}

	return (
		<SafeAreaProvider>
			<View style={styles.container}>
				<Portal>
					<Modal
						visible={isSummaryModalVisible}
						onDismiss={() => setSummaryModalVisible(false)}
						contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}
					>
						<Text variant="headlineSmall" style={{ marginBottom: 10 }}>费用统计结果</Text>
						<Text variant="bodyMedium" style={{ marginBottom: 20 }}>{dateRange}</Text>
						<DataTable>
							<DataTable.Header>
								<DataTable.Title><Text>家庭</Text></DataTable.Title>
								<DataTable.Title numeric><Text>总计费用</Text></DataTable.Title>
							</DataTable.Header>
							{summaryData.map((item) => (
								<DataTable.Row key={item.name}>
									<DataTable.Cell><Text>{item.name}</Text></DataTable.Cell>
									<DataTable.Cell numeric><Text>${item.totalCost.toFixed(2)}</Text></DataTable.Cell>
								</DataTable.Row>
							))}
						</DataTable>
						<View style={styles.modalButtons}>
							<Button onPress={() => setSummaryModalVisible(false)} style={{ flex: 1 }}>关闭</Button>
							<Button icon="file-pdf-box" mode="contained" onPress={handleShareSummaryPdf} style={{ flex: 1.5 }}>生成并分享 PDF</Button>
						</View>
					</Modal>
				</Portal>

				<DatePickerModal locale="zh" mode="single" visible={isStartDatePickerVisible} onDismiss={() => setStartDatePickerVisible(false)} date={startDate} onConfirm={(params) => { setStartDatePickerVisible(false); setStartDate(params.date); }} />
				<DatePickerModal locale="zh" mode="single" visible={isEndDatePickerVisible} onDismiss={() => setEndDatePickerVisible(false)} date={endDate} onConfirm={(params) => { setEndDatePickerVisible(false); setEndDate(params.date); }} />

				<FlatList
					data={filteredBills}
					keyExtractor={(item) => item.id.toString()}
					renderItem={renderBillItem}
					ListHeaderComponent={
						<>
							<FilterSection />
							<SummarySection />
						</>
					}
					ListEmptyComponent={renderEmptyState}
					contentContainerStyle={styles.listContent}
				/>

				{isEditMode ? (
					<Appbar style={styles.bottomAppbar}>
						<Appbar.Action icon="delete" onPress={handleBulkDelete} disabled={selectedBillIds.size === 0} />
					</Appbar>
				) : (
					<Portal>
						<FAB.Group
							open={fabOpen}
							visible
							icon={fabOpen ? 'close' : 'plus'}
							actions={[
								{
									icon: 'file-multiple',
									label: '批量创建账单',
									onPress: () => router.push('/batch-create'),
									size: 'small',
								},
								{
									icon: 'file',
									label: '创建单张账单',
									onPress: () => router.push('/input'),
									size: 'small',
								},
							]}
							onStateChange={({ open }) => setFabOpen(open)}
						/>
					</Portal>
				)}
			</View>
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	listContent: { paddingHorizontal: 16, paddingBottom: 80 },
	card: { marginBottom: 12 },
	summaryCard: { marginBottom: 20, marginTop: 16 },
	datePickerContainer: { flexDirection: 'row' },
	cardRightText: { marginRight: 16, fontSize: 14 },
	emptyText: { marginTop: 8 },
	fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
	modalContainer: { padding: 20, margin: 20, borderRadius: 8 },
	modalButtons: { flexDirection: 'row', marginTop: 20, justifyContent: 'space-between', gap: 10 },
	bottomAppbar: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'center' },
	filterHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	chipContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 8,
	},
	chip: {
		marginRight: 8,
		marginBottom: 8,
	},
});
