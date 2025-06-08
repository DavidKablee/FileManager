import { useColorScheme } from 'react-native';

export const lightTheme = {
  primary: '#f4511e',
  background: '#ffffff',
  card: '#ffffff',
  text: '#000000',
  border: '#e0e0e0',
  secondaryText: '#666666',
  icon: '#f4511e',
  headerBackground: '#f4511e',
  headerText: '#ffffff',
  itemBackground: '#ffffff',
  itemBorder: '#f3f3f3',
  emptyText: '#888888',
  statusBar: 'dark',
  shadowColor: '#000000',
  elevation: 4,
  shadowOpacity: 0.1,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
};

export const darkTheme = {
  primary: '#ff7043',
  background: '#121212',
  card: '#1e1e1e',
  text: '#ffffff',
  border: '#2c2c2c',
  secondaryText: '#b0b0b0',
  icon: '#ff7043',
  headerBackground: '#1e1e1e',
  headerText: '#ffffff',
  itemBackground: '#1e1e1e',
  itemBorder: '#2c2c2c',
  emptyText: '#b0b0b0',
  statusBar: 'light',
  shadowColor: '#000000',
  elevation: 8,
  shadowOpacity: 0.3,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}; 