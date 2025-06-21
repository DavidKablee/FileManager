import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, View, Alert, Platform, PermissionsAndroid } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FileExplorer from './src/screens/FileExplorer';
import HomeScreen from './src/screens/HomeScreen';
import RecycleBinScreen from './src/screens/RecycleBinScreen';
import { ThemeProvider } from './src/utils/ThemeContext';
import { useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Linking } from 'react-native';
import { initializeRecycleBin } from './src/utils/RecycleBin';

const Stack = createNativeStackNavigator();

export const requestStoragePermission = async () => {
  if (Platform.OS === 'android') {
    try {
      // For Android 13+ (API 33+), we need different permissions
      if (Platform.Version >= 33) {
        // Request READ_MEDIA_* permissions for Android 13+
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        // Check if all permissions are granted
        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          // If not all granted, show alert and return false
          Alert.alert(
            'Permission Required',
            'Please grant all media permissions to access your files. For full file manager access, you may need to grant "All files access" in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          return false;
        }

        return true;
      } else {
        // For Android 12 and below, use the old permissions
        const readGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Access Required',
            message: 'This app needs access to your files to work properly.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        const writeGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Access Required',
            message: 'This app needs access to your files to work properly.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        return (
          readGranted === PermissionsAndroid.RESULTS.GRANTED &&
          writeGranted === PermissionsAndroid.RESULTS.GRANTED
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  return true;
};

const App = () => {
  useEffect(() => {
    const setup = async () => {
      try {
        // Initialize recycle bin
        await initializeRecycleBin();
        
        // Request storage permissions
        const storageGranted = await requestStoragePermission();
        if (!storageGranted) {
          console.log('Storage permissions not granted');
          return;
        }

        // Request media library permissions
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Media Library Permission Required',
            'Please grant media library permission to access your media files.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
        }

        console.log('All permissions granted successfully');
      } catch (error) {
        console.error('Error during setup:', error);
      }
    };

    setup();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#000' },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="FileExplorer" component={FileExplorer} />
            <Stack.Screen name="RecycleBin" component={RecycleBinScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default App;

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
