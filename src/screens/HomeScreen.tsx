import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../utils/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';

type RootStackParamList = {
  Home: undefined;
  FileExplorer: { initialPath: string; title: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

// Helper to format bytes to GB
const formatBytesToGB = (bytes: number) => {
  if (bytes === 0) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
};

const HomeScreen = () => {
  const { theme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  const [internalStorage, setInternalStorage] = useState('Loading...');
  const [sdCardStorage, setSdCardStorage] = useState('Not inserted');

  useEffect(() => {
    const getStorageInfo = async () => {
      try {
        const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
        const totalDiskCapacity = await FileSystem.getTotalDiskCapacityAsync();

        setInternalStorage(
          `${formatBytesToGB(totalDiskCapacity - freeDiskStorage)} / ${formatBytesToGB(totalDiskCapacity)}`
        );
      } catch (error) {
        console.error('Error getting storage info:', error);
        setInternalStorage('Error');
      }
    };

    getStorageInfo();
  }, []);

  const STORAGE_DATA = [
    {
      icon: <View><MaterialIcons name="smartphone" size={22} color="#6EC1E4" /></View>, label: 'Internal storage', value: internalStorage,
    },
    {
      icon: <View><MaterialIcons name="sd-card" size={22} color="#A084E8" /></View>, label: 'SD card', value: sdCardStorage,
    },
  ];

  // Function to get common directories, creating them if they don't exist
  const getCommonDirectoryPath = async (subDir: string) => {
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error('Document directory not available');
    }
    const fullPath = `${baseDir}${subDir}/`;
    const dirInfo = await FileSystem.getInfoAsync(fullPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });
    }
    return fullPath;
  };

  const CATEGORY_DATA = [
    {
      icon: <View><MaterialIcons name="image" size={28} color="#6EC1E4" /></View>, label: 'Images',
      onPress: async () => navigation.navigate('FileExplorer', { initialPath: await getCommonDirectoryPath('Pictures'), title: 'Images' }),
    },
    {
      icon: <View><MaterialIcons name="videocam" size={28} color="#A084E8" /></View>, label: 'Videos',
      onPress: async () => navigation.navigate('FileExplorer', { initialPath: await getCommonDirectoryPath('Videos'), title: 'Videos' }),
    },
    {
      icon: <View><MaterialIcons name="music-note" size={28} color="#F67280" /></View>, label: 'Audio files',
      onPress: async () => navigation.navigate('FileExplorer', { initialPath: await getCommonDirectoryPath('Music'), title: 'Audio files' }),
    },
    {
      icon: <View><MaterialIcons name="description" size={28} color="#B5E61D" /></View>, label: 'Documents',
      onPress: async () => navigation.navigate('FileExplorer', { initialPath: await getCommonDirectoryPath('Documents'), title: 'Documents' }),
    },
    {
      icon: <View><MaterialIcons name="file-download" size={28} color="#00B8A9" /></View>, label: 'Downloads',
      onPress: async () => navigation.navigate('FileExplorer', { initialPath: await getCommonDirectoryPath('Downloads'), title: 'Downloads' }),
    },
    {
      icon: <View><MaterialCommunityIcons name="android" size={28} color="#B388FF" /></View>, label: 'APK\nInstallation files',
      onPress: async () => navigation.navigate('FileExplorer', { initialPath: FileSystem.documentDirectory || '', title: 'APK Files' }), // Navigate to root for APKs, as a specific folder is unlikely via default FS
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: '#111' }]}> {/* Force dark background */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>My Files</Text>

        {/* Recent files button */}
        <TouchableOpacity
          style={styles.recentFilesBtn}
          onPress={() => navigation.navigate('FileExplorer', { initialPath: FileSystem.documentDirectory || '', title: 'Recent Files' })} // Navigate to FileExplorer for recent files
        >
          <MaterialIcons name="access-time" size={22} color="#B5E61D" />
          <Text style={styles.recentFilesText}>Recent files</Text>
        </TouchableOpacity>

        {/* Categories grid */}
        <View style={styles.categoriesSection}>
          {CATEGORY_DATA.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.categoryBtn} onPress={item.onPress}>
              {item.icon}
              <Text style={styles.categoryLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Storage section */}
        <View style={styles.storageSection}>
          {STORAGE_DATA.map((item, idx) => (
            <View key={idx} style={styles.storageCard}>
              {item.icon}
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.storageLabel}>{item.label}</Text>
                <Text style={styles.storageValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recycle bin & Analyse storage */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={() => Alert.alert('Recycle Bin', 'This feature is not yet implemented.')}
          >
            <MaterialIcons name="delete" size={22} color="#B5E61D" />
            <Text style={styles.bottomBtnText}>Recycle bin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={() => Alert.alert('Analyse Storage', 'This feature is not yet implemented.')}
          >
            <Ionicons name="search" size={22} color="#6EC1E4" />
            <Text style={styles.bottomBtnText}>Analyse storage</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    alignSelf: 'center',
    marginVertical: 24,
  },
  recentFilesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginBottom: 18,
  },
  recentFilesText: {
    color: '#fff',
    fontSize: 17,
    marginLeft: 12,
    fontWeight: '500',
  },
  categoriesSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 28,
  },
  categoryBtn: {
    width: (width - 48) / 3,
    backgroundColor: '#181818',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 22,
    marginBottom: 16,
  },
  categoryLabel: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  storageSection: {
    marginHorizontal: 12,
    marginBottom: 28,
  },
  storageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  storageLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  storageValue: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  bottomSection: {
    marginHorizontal: 12,
  },
  bottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  bottomBtnText: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 12,
    fontWeight: '500',
  },
});

export default HomeScreen; 