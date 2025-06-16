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

async function requestAllPermissions() {
  if (Platform.OS === 'android') {
    try {
      // For Android 13 (API level 33) and above
      if (Platform.Version >= 33) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.MANAGE_EXTERNAL_STORAGE,
        ];

        const results = await Promise.all(
          permissions.map(permission => PermissionsAndroid.request(permission))
        );

        const allGranted = results.every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Full Access Required',
            'This app needs full access to your device storage to function like a file manager. Please grant all permissions.',
            [
              {
                text: 'Open Settings',
                onPress: () => {
                  PermissionsAndroid.openSettings();
                },
              },
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ]
          );
          return false;
        }
      } else {
        // For Android 12 and below
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.MANAGE_EXTERNAL_STORAGE,
        ];

        const results = await Promise.all(
          permissions.map(permission => PermissionsAndroid.request(permission))
        );

        const allGranted = results.every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Full Access Required',
            'This app needs full access to your device storage to function like a file manager. Please grant all permissions.',
            [
              {
                text: 'Open Settings',
                onPress: () => {
                  PermissionsAndroid.openSettings();
                },
              },
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ]
          );
          return false;
        }
      }

      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant media library permission to access files.',
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
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }
  return true;
}

const App = () => {
  useEffect(() => {
    const setup = async () => {
      try {
        // Initialize recycle bin
        await initializeRecycleBin();
        await requestAllPermissions();
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
