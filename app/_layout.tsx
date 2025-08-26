import { Stack } from 'expo-router';
import { PaperProvider, useTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { AppLightTheme, AppDarkTheme } from '@/constants/theme';
import React, { useState, useEffect, useCallback, createContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext({
  toggleTheme: () => {},
});

function AppNavigator() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.onSurface,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="index"/>
      <Stack.Screen
        name="input"
        options={{
          title: '创建新账单',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          title: '费用明细',
        }}
      />
      <Stack.Screen
        name="families"
        options={{
          title: '家庭管理',
        }}
      />
      <Stack.Screen
        name="batch-create"
        options={{
          title: '批量创建账单',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(systemColorScheme);

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme) {
        setThemeMode(savedTheme as 'light' | 'dark');
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = useCallback(async () => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  }, [themeMode]);

  const theme = themeMode === 'dark' ? AppDarkTheme : AppLightTheme;

  return (
    <ThemeContext.Provider value={{ toggleTheme }}>
      <PaperProvider theme={theme}>
        <AppNavigator />
      </PaperProvider>
    </ThemeContext.Provider>
  );
}
