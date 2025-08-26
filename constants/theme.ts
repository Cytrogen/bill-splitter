import {
	MD3LightTheme,
	MD3DarkTheme,
	adaptNavigationTheme,
} from 'react-native-paper';
import {
	DefaultTheme as NavigationDefaultTheme,
	DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';

// --- Light Theme ---
const AppLightTheme = {
	...MD3LightTheme,
	colors: {
		...MD3LightTheme.colors,
		primary: 'hsl(210, 80%, 20%)', // Accent color for buttons, etc.
		background: 'hsl(270, 50%, 90%)', // Primary background
		surface: 'hsl(270, 50%, 95%)', // Card and component backgrounds
		surfaceVariant: 'hsl(270, 50%, 95%)', // Input field background
		onSurface: 'hsl(270, 50%, 10%)', // Main text color
		onSurfaceVariant: 'hsl(270, 50%, 20%)', // Secondary text/placeholder color
		tertiary: 'hsl(330, 80%, 20%)',
		// You can add more color overrides here if needed
	},
};

// --- Dark Theme ---
const AppDarkTheme = {
	...MD3DarkTheme,
	colors: {
		...MD3DarkTheme.colors,
		primary: 'hsl(210, 80%, 80%)', // Accent color
		background: 'hsl(270, 50%, 10%)', // Primary background
		surface: 'hsl(270, 50%, 15%)', // Card and component backgrounds
		surfaceVariant: 'hsl(270, 50%, 20%)', // Input field background
		onSurface: 'hsl(270, 50%, 90%)', // Main text color
		onSurfaceVariant: 'hsl(270, 50%, 80%)', // Secondary text/placeholder color
		tertiary: 'hsl(330, 80%, 80%)',
	},
};

export { AppLightTheme, AppDarkTheme };
