import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import {
	Button,
	Card,
	FAB,
	IconButton,
	Modal,
	Portal,
	Text,
	TextInput,
	useTheme,
	ActivityIndicator,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

interface Member {
	id: number;
	name: string;
}

interface Family {
	id: number;
	name: string;
	members: Member[];
}

export default function FamiliesScreen() {
	const theme = useTheme();
	const [families, setFamilies] = useState<Family[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isModalVisible, setModalVisible] = useState(false);
	const [currentFamily, setCurrentFamily] = useState<Partial<Family> | null>(null);

	useFocusEffect(
		useCallback(() => {
			const loadFamilies = async () => {
				setIsLoading(true);
				try {
					const familiesJson = await AsyncStorage.getItem('families');
					setFamilies(familiesJson ? JSON.parse(familiesJson) : []);
				} catch (error) {
					console.error('Failed to load families:', error);
				} finally {
					setIsLoading(false);
				}
			};

			loadFamilies();
		}, [])
	);

	const openModal = (family: Partial<Family> | null = null) => {
		setCurrentFamily(
			family || { id: Date.now(), name: '', members: [{ id: Date.now(), name: '' }] }
		);
		setModalVisible(true);
	};

	const closeModal = () => {
		setModalVisible(false);
		setCurrentFamily(null);
	};

	const handleSaveFamily = async () => {
		if (!currentFamily || !currentFamily.name) {
			Alert.alert('提示', '请输入家庭名称。');
			return;
		}
		const finalFamily = {
			...currentFamily,
			members: currentFamily.members?.filter(m => m.name.trim() !== '') || [],
		} as Family;

		const newFamilies = [...families];
		const existingIndex = newFamilies.findIndex(f => f.id === finalFamily.id);

		if (existingIndex > -1) {
			newFamilies[existingIndex] = finalFamily;
		} else {
			newFamilies.push(finalFamily);
		}

		try {
			await AsyncStorage.setItem('families', JSON.stringify(newFamilies));
			setFamilies(newFamilies);
			closeModal();
		} catch (error) {
			console.error('Failed to save family:', error);
		}
	};

	const handleDeleteFamily = async (familyId: number) => {
		Alert.alert("确认删除", "您确定要删除这个家庭吗？此操作无法撤销。", [
			{ text: "取消", style: "cancel" },
			{ text: "删除", style: "destructive", onPress: async () => {
					const newFamilies = families.filter(f => f.id !== familyId);
					try {
						await AsyncStorage.setItem('families', JSON.stringify(newFamilies));
						setFamilies(newFamilies);
					} catch (error) {
						console.error('Failed to delete family:', error);
					}
				}}
		]);
	};

	const updateMemberName = (memberId: number, name: string) => {
		if (!currentFamily || !currentFamily.members) return;
		const updatedMembers = currentFamily.members.map(m =>
			m.id === memberId ? { ...m, name } : m
		);
		setCurrentFamily({ ...currentFamily, members: updatedMembers });
	};

	const addMemberField = () => {
		if (!currentFamily) return;
		const newMember = { id: Date.now(), name: '' };
		const members = [...(currentFamily.members || []), newMember];
		setCurrentFamily({ ...currentFamily, members });
	};

	const removeMemberField = (memberId: number) => {
		if (!currentFamily || !currentFamily.members) return;
		const members = currentFamily.members.filter(m => m.id !== memberId);
		setCurrentFamily({ ...currentFamily, members });
	};

	if (isLoading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Portal>
				<Modal visible={isModalVisible} onDismiss={closeModal} contentContainerStyle={[styles.modalContainer, { backgroundColor: theme.colors.surface }]}>
					<Text variant="headlineSmall" style={{ marginBottom: 20 }}>
						{currentFamily?.id ? '编辑家庭' : '新增家庭'}
					</Text>
					<TextInput
						label="家庭名称"
						value={currentFamily?.name || ''}
						onChangeText={name => setCurrentFamily({ ...currentFamily, name })}
						mode="outlined"
						style={{ marginBottom: 16 }}
					/>
					<Text variant="titleMedium" style={{ marginBottom: 8 }}>成员列表</Text>
					{currentFamily?.members?.map(member => (
						<View key={member.id} style={styles.memberInputContainer}>
							<TextInput
								label="成员姓名"
								value={member.name}
								onChangeText={text => updateMemberName(member.id, text)}
								mode="outlined"
								style={{ flex: 1 }}
							/>
							<IconButton icon="delete" onPress={() => removeMemberField(member.id)} />
						</View>
					))}
					<Button icon="plus" onPress={addMemberField} style={{ marginTop: 8 }}>添加成员</Button>
					<Button mode="contained" onPress={handleSaveFamily} style={{ marginTop: 24 }}>保存</Button>
				</Modal>
			</Portal>

			{families.length === 0 ? (
				<View style={styles.center}>
					<Text>还没有家庭信息，点击右下角按钮添加一个吧！</Text>
				</View>
			) : (
				<FlatList
					data={families}
					keyExtractor={item => item.id.toString()}
					renderItem={({ item }) => (
						<Card style={styles.card}>
							<Card.Title
								title={item.name}
								subtitle={`成员: ${item.members.map(m => m.name).join(', ')}`}
								right={() => (
									<View style={{ flexDirection: 'row' }}>
										<IconButton icon="pencil" onPress={() => openModal(item)} />
										<IconButton icon="delete" onPress={() => handleDeleteFamily(item.id)} />
									</View>
								)}
							/>
						</Card>
					)}
				/>
			)}

			<FAB icon="plus" style={styles.fab} onPress={() => openModal()} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	fab: {
		position: 'absolute',
		margin: 16,
		right: 0,
		bottom: 0,
	},
	card: {
		margin: 8,
	},
	modalContainer: {
		padding: 20,
		margin: 20,
		borderRadius: 8,
	},
	memberInputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8,
	},
});
