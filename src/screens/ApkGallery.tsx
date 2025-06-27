import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, Modal, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatFileSize } from '../utils/FileManagement';
import * as RNFS from 'react-native-fs';
import * as IntentLauncher from 'expo-intent-launcher';

type RootStackParamList = {
  Home: undefined;
  RecycleBin: undefined;
  ApkGallery: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ApkItem = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  packageName?: string;
  versionName?: string;
};

const ApkGallery = () => {
  const [apkFiles, setApkFiles] = useState<ApkItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const loadApkFiles = async () => {
    try {
      const directories = [
        RNFS.DownloadDirectoryPath,
        RNFS.ExternalStorageDirectoryPath + '/Download',
        RNFS.ExternalStorageDirectoryPath + '/Downloads'
      ];

      let allApks: ApkItem[] = [];
      
      for (const dir of directories) {
        try {
          const files = await RNFS.readDir(dir);
          const apkFiles = files.filter(file => file.name.toLowerCase().endsWith('.apk'));
          
          const items = apkFiles.map(file => ({
            name: file.name,
            path: file.path,
            size: file.size,
            modifiedTime: new Date(file.mtime || Date.now()).toISOString(),
            packageName: file.name.replace('.apk', '')
          }));

          allApks = [...allApks, ...items];
        } catch (error) {
          console.warn(`Error reading directory ${dir}:`, error);
        }
      }

      // Remove duplicates based on file name and size
      const uniqueApks = Array.from(
        new Map(allApks.map(file => [`${file.name}-${file.size}`, file])).values()
      );

      // Sort by modified time
      uniqueApks.sort((a, b) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      const totalApkSize = uniqueApks.reduce((acc, curr) => acc + curr.size, 0);
      setTotalSize(totalApkSize);
      setApkFiles(uniqueApks);
    } catch (error) {
      console.error('Error loading APK files:', error);
    }
  };

  useEffect(() => {
    loadApkFiles();
  }, []);

  const handleShare = async () => {
    try {
      if (selectedItems.length === 0) return;

      if (Platform.OS === 'android') {
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          const filesToShare = selectedItems.map(path => path);
          await Sharing.shareAsync(filesToShare[0], {
            dialogTitle: 'Share APK',
            mimeType: 'application/vnd.android.package-archive',
            UTI: 'public.data'
          });
        }
      } else {
        await Share.share({
          url: selectedItems[0],
          message: selectedItems.length > 1 ? `Sharing ${selectedItems.length} APK files` : undefined
        });
      }
    } catch (error) {
      console.error('Error sharing files:', error);
    }
  };

  const toggleItemSelection = (path: string) => {
    if (selectedItems.includes(path)) {
      setSelectedItems(prev => prev.filter(p => p !== path));
      if (selectedItems.length === 1) {
        setIsSelectionMode(false);
      }
    } else {
      setSelectedItems(prev => [...prev, path]);
    }
  };

  const handleApkPress = async (item: ApkItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.path);
      return;
    }

    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: item.path,
          flags: 1,
          type: 'application/vnd.android.package-archive'
        });
      }
    } catch (error) {
      console.error('Error opening APK:', error);
    }
  };

  const handleApkLongPress = (path: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    toggleItemSelection(path);
  };

  const handleMenuPress = () => {
    setIsMenuVisible(true);
  };

  const handleEditPress = () => {
    setIsMenuVisible(false);
    setIsSelectionMode(true);
  };

  const handleRecycleBinPress = () => {
    setIsMenuVisible(false);
    navigation.navigate('RecycleBin');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => {
        if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedItems([]);
        } else {
          navigation.goBack();
        }
      }} style={styles.backButton}>
        <MaterialIcons name={isSelectionMode ? "close" : "arrow-back"} size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>
          {isSelectionMode ? `${selectedItems.length} selected` : 'APK files'}
        </Text>
        {!isSelectionMode && <Text style={styles.subtitle}>{formatFileSize(totalSize)}</Text>}
      </View>
      <View style={styles.headerRight}>
        {isSelectionMode ? (
          <>
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <MaterialIcons name="share" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialIcons name="delete" size={24} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.iconButton} onPress={handleMenuPress}>
            <MaterialIcons name="more-vert" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderApkItem = ({ item }: { item: ApkItem }) => (
    <TouchableOpacity 
      style={[
        styles.apkItem,
        selectedItems.includes(item.path) && styles.selectedApkItem
      ]}
      onPress={() => handleApkPress(item)}
      onLongPress={() => handleApkLongPress(item.path)}
    >
      <View style={[
        styles.iconContainer,
        selectedItems.includes(item.path) && styles.selectedIconContainer
      ]}>
        <MaterialIcons name="android" size={32} color="#3DDC84" />
      </View>
      <View style={styles.apkInfo}>
        <Text style={styles.apkName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.packageName && (
          <Text style={styles.packageName} numberOfLines={1}>
            {item.packageName}
          </Text>
        )}
        <Text style={styles.apkDate}>
          {new Date(item.modifiedTime).toLocaleDateString()}
        </Text>
      </View>
      {selectedItems.includes(item.path) ? (
        <MaterialIcons name="check-circle" size={24} color="#B5E61D" />
      ) : (
        <Text style={styles.apkSize}>
          {formatFileSize(item.size)}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderMenu = () => (
    <Modal
      visible={isMenuVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setIsMenuVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        onPress={() => setIsMenuVisible(false)}
      >
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={handleEditPress}>
            <MaterialIcons name="edit" size={24} color="white" />
            <Text style={styles.menuText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleRecycleBinPress}>
            <MaterialIcons name="delete" size={24} color="white" />
            <Text style={styles.menuText}>Recycle Bin</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={apkFiles}
        renderItem={renderApkItem}
        keyExtractor={item => item.path}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
      {renderMenu()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000000'
  },
  backButton: {
    marginRight: 16
  },
  titleContainer: {
    flex: 1
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold'
  },
  subtitle: {
    color: '#888888',
    fontSize: 14
  },
  headerRight: {
    flexDirection: 'row'
  },
  iconButton: {
    marginLeft: 16
  },
  listContainer: {
    paddingHorizontal: 16
  },
  apkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333'
  },
  selectedApkItem: {
    backgroundColor: 'rgba(181, 230, 29, 0.1)'
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(61, 220, 132, 0.1)',
    borderRadius: 8
  },
  selectedIconContainer: {
    backgroundColor: 'rgba(181, 230, 29, 0.2)',
  },
  apkInfo: {
    flex: 1,
    marginRight: 16
  },
  apkName: {
    color: 'white',
    fontSize: 16,
    marginBottom: 4
  },
  packageName: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 2
  },
  apkDate: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2
  },
  apkSize: {
    color: '#888888',
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  menuContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  menuText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 16
  }
});

export default ApkGallery; 