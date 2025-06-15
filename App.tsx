import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FileExplorer from './src/screens/FileExplorer';
import HomeScreen from './src/screens/HomeScreen';
import { ThemeProvider } from './src/utils/ThemeContext';
import { useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Linking } from 'react-native';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  const requestAllPermissions = async () => {
    try {
      // Request media library permissions
      const mediaPermission = await MediaLibrary.requestPermissionsAsync();
      
      if (!mediaPermission.granted) {
        Alert.alert(
          'Storage Permission Required',
          'This app needs access to your storage to manage your files. Please grant permission to continue.',
          [
            { 
              text: 'Grant Permission', 
              onPress: async () => {
                if (Platform.OS === 'ios') {
                  await Linking.openURL('app-settings:');
                } else {
                  await Linking.openSettings();
                }
              }
            },
            { 
              text: 'Cancel', 
              style: 'cancel',
              onPress: () => {
                Alert.alert(
                  'Permission Required',
                  'Without storage permission, the app cannot function properly. Please restart the app and grant permission when prompted.',
                  [{ text: 'OK' }]
                );
              }
            }
          ]
        );
        return false;
      }

      // For Android, we need to check if we can access the storage
      if (Platform.OS === 'android') {
        try {
          const testPath = '/storage/emulated/0/DCIM';
          const dirInfo = await FileSystem.getInfoAsync(testPath);
          if (!dirInfo.exists) {
            Alert.alert(
              'Storage Access Required',
              'Please grant storage access permission in your device settings to use this app.',
              [
                { 
                  text: 'Open Settings', 
                  onPress: () => Linking.openSettings()
                },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
            return false;
          }
        } catch (error) {
          console.error('Storage access error:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert(
        'Error',
        'Failed to request permissions. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      const hasPermissions = await requestAllPermissions();
      setIsLoading(false);
      
      if (!hasPermissions) {
        // Show a final message if permissions weren't granted
        Alert.alert(
          'Permission Required',
          'This app requires storage permission to function. Please restart the app and grant permission when prompted.',
          [{ text: 'OK' }]
        );
      }
    };

    initializeApp();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6EC1E4" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <SafeAreaView style={styles.container}>
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="FileExplorer" component={FileExplorer} />
            </Stack.Navigator>
            <StatusBar style="auto" />
          </SafeAreaView>
        </NavigationContainer>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
