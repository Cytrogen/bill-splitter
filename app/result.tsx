import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Platform, Alert } from 'react-native';
import { Button, Card, DataTable, Text, useTheme } from 'react-native-paper';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FamilyData {
	id: number;
	name: string;
	lines: number;
	extraService: {
		hasService: boolean;
		cost: number;
	};
}

interface ResultData {
	id: number | null; // Can be null for new bills
	billMonth: string;
	totalCost: number;
	costPerLine: number;
	families: FamilyData[];
}

const generatePdfHtml = (data: ResultData, theme: any): string => {
	const familiesHtml = data.families
		.map((family, index) => {
			const familyLineCost = family.lines * data.costPerLine;
			const familyTotalCost = familyLineCost + family.extraService.cost;
			return `
      <div class="family-card">
        <h2>${family.name} 明细</h2>
        <table>
          <tr>
            <td>线路费用 (${family.lines} 条)</td>
            <td class="numeric">$${familyLineCost.toFixed(2)}</td>
          </tr>
          ${
				family.extraService.hasService
					? `<tr>
                  <td>额外服务</td>
                  <td class="numeric">$${family.extraService.cost.toFixed(
						2
					)}</td>
                </tr>`
					: ''
			}
          <tr class="total">
            <td><b>总计</b></td>
            <td class="numeric"><b>$${familyTotalCost.toFixed(2)}</b></td>
          </tr>
        </table>
      </div>
    `;
		})
		.join('');

	return `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: ${
		theme.colors.onSurface
	}; background-color: ${theme.colors.background}; }
          .header { text-align: center; border-bottom: 2px solid ${
		theme.colors.surface
	}; padding-bottom: 10px; margin-bottom: 20px; }
          .summary-card, .family-card { border: 1px solid ${
		theme.colors.surface
	}; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          h1 { font-size: 24px; margin: 0; }
          h2 { font-size: 18px; border-bottom: 1px solid ${
		theme.colors.surface
	}; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 0; }
          .numeric { text-align: right; }
          .total { border-top: 1px solid ${theme.colors.surface}; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>话费账单明细 (${data.billMonth})</h1>
        </div>
        <div class="summary-card">
          <h2>费用总览</h2>
          <table>
            <tr>
              <td>账单总金额</td>
              <td class="numeric">$${data.totalCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td>每条线路单价</td>
              <td class="numeric">$${data.costPerLine.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        ${familiesHtml}
      </body>
    </html>
  `;
};

export default function ResultScreen() {
	const router = useRouter();
	const theme = useTheme();
	const params = useLocalSearchParams();

	const [isSaved, setIsSaved] = useState(false);

	const data: ResultData | null = params.data
		? JSON.parse(params.data as string)
		: null;

	const handleGeneratePdf = async () => {
		if (!data) return;
		const html = generatePdfHtml(data, theme);
		try {
			const { uri } = await Print.printToFileAsync({ html });
			if (Platform.OS === 'ios') {
				await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
			} else {
				await Sharing.shareAsync(uri);
			}
		} catch (error) {
			console.error('Failed to generate or share PDF:', error);
		}
	};

	const handleSaveBill = async () => {
		if (!data) return;
		try {
			const existingBillsJson = await AsyncStorage.getItem('bills');
			let existingBills = existingBillsJson ? JSON.parse(existingBillsJson) : [];

			if (data.id) {
				const billIndex = existingBills.findIndex((bill: ResultData) => bill.id === data.id);
				if (billIndex > -1) {
					existingBills[billIndex] = data;
				} else {
					existingBills.push({ ...data, id: Date.now() });
				}
			} else {
				const newBill = { ...data, id: Date.now() };
				existingBills.push(newBill);
			}

			await AsyncStorage.setItem('bills', JSON.stringify(existingBills));
			setIsSaved(true);
			Alert.alert('保存成功', '这份账单已成功保存。');
		} catch (error) {
			Alert.alert('保存失败', '无法保存账单，请稍后再试。');
			console.error('Failed to save bill:', error);
		}
	};

	if (!data) {
		return (
			<View style={styles.container}>
				<Text>无法加载计算结果。</Text>
			</View>
		);
	}

	return (
		<ScrollView style={styles.container}>
			<Card style={styles.card}>
				<Card.Title title="费用总览" subtitle={`账单月份: ${data.billMonth}`} />
				<Card.Content>
					<DataTable>
						<DataTable.Header>
							<DataTable.Title>项目</DataTable.Title>
							<DataTable.Title numeric>金额</DataTable.Title>
						</DataTable.Header>
						<DataTable.Row>
							<DataTable.Cell>账单总金额</DataTable.Cell>
							<DataTable.Cell numeric>${data.totalCost.toFixed(2)}</DataTable.Cell>
						</DataTable.Row>
						<DataTable.Row>
							<DataTable.Cell>每条线路单价</DataTable.Cell>
							<DataTable.Cell numeric>${data.costPerLine.toFixed(2)}</DataTable.Cell>
						</DataTable.Row>
					</DataTable>
				</Card.Content>
			</Card>

			{data.families.map((family, index) => {
				const familyLineCost = family.lines * data.costPerLine;
				const familyTotalCost = familyLineCost + family.extraService.cost;
				return (
					<Card key={family.id} style={styles.card}>
						<Card.Title title={`${family.name} 明细`} />
						<Card.Content>
							<DataTable>
								<DataTable.Row>
									<DataTable.Cell>线路费用 ({family.lines} 条)</DataTable.Cell>
									<DataTable.Cell numeric>${familyLineCost.toFixed(2)}</DataTable.Cell>
								</DataTable.Row>
								{family.extraService.hasService && (
									<DataTable.Row>
										<DataTable.Cell>额外服务</DataTable.Cell>
										<DataTable.Cell numeric>${family.extraService.cost.toFixed(2)}</DataTable.Cell>
									</DataTable.Row>
								)}
								<DataTable.Row style={styles.totalRow}>
									<DataTable.Cell>
										<Text variant="titleMedium">总计</Text>
									</DataTable.Cell>
									<DataTable.Cell numeric>
										<Text variant="titleMedium">${familyTotalCost.toFixed(2)}</Text>
									</DataTable.Cell>
								</DataTable.Row>
							</DataTable>
						</Card.Content>
					</Card>
				);
			})}

			<View style={styles.buttonContainer}>
				<Button
					icon="content-save"
					mode="contained-tonal"
					onPress={handleSaveBill}
					style={styles.actionButton}
					disabled={isSaved}
				>
					{isSaved ? '已保存' : '保存此账单'}
				</Button>
				<Button
					icon="file-pdf-box"
					mode="contained"
					onPress={handleGeneratePdf}
					style={styles.actionButton}
				>
					生成并分享 PDF
				</Button>
			</View>
		</ScrollView>
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
	totalRow: {
		borderTopWidth: 1,
		borderTopColor: '#e0e0e0',
		marginTop: 8,
	},
	buttonContainer: {
		marginVertical: 16,
		marginHorizontal: 8,
		gap: 12,
	},
	actionButton: {
		paddingVertical: 4,
	},
});
