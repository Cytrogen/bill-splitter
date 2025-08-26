import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '页面未找到' }} />
      <View style={styles.container}>
        <Text variant="headlineMedium">Oops!</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          这个页面不存在。
        </Text>
        <Link href="/" style={styles.link}>
          <Text variant="labelLarge" style={styles.linkText}>
            返回首页
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  subtitle: {
    marginTop: 8,
    color: '#888',
  },
  link: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  linkText: {
    fontWeight: 'bold',
  },
});
