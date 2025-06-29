import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert, Modal, TextInput, FlatList, ActivityIndicator, Platform, Linking } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../utils/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import { searchItems, checkAndRequestPermissions, checkPermissionsStatus, hasFullFileAccess, requestFullFileAccess, getAllStorageLocations, isPathAccessible, showFullAccessInstructions } from '../utils/FileManagement';
import { getRecentFiles, RecentFile } from '../utils/RecentFiles';
import { formatFileSize } from '../utils/FileManagement';
import RNFS from 'react-native-fs';

type RootStackParamList = {
  Home: undefined;
  FileExplorer: { initialPath: string; title: string };
  RecycleBin: undefined;
  VideoGallery: undefined;
  AudioGallery: undefined;
  DocumentGallery: undefined;
  DownloadsGallery: undefined;
  ApkGallery: undefined;
  SearchScreen: undefined;
  InternalStorage: undefined;
  ImageGallery: undefined;
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
  const [hasSDCard, setHasSDCard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [storageLocations, setStorageLocations] = useState<string[]>([]);

  const checkSDCard = async () => {
    try {
      // Common paths for external SD card on Android
      const possiblePaths = [
        '/storage/sdcard1',
        '/storage/extSdCard',
        '/storage/external_SD',
        '/storage/ext_sd',
        '/mnt/extSdCard'
      ];

      for (const path of possiblePaths) {
        try {
          const stats = await RNFS.stat(path);
          if (stats.isDirectory()) {
            setHasSDCard(true);
            // Get SD card storage info
            const files = await RNFS.readDir(path);
            const totalSize = files.reduce((acc, file) => acc + (file.size || 0), 0);
            setSdCardStorage(formatBytesToGB(totalSize));
            return;
          }
        } catch (e) {
          // Path not accessible or doesn't exist
          continue;
        }
      }
      // No SD card found
      setHasSDCard(false);
      setSdCardStorage('Not inserted');
    } catch (error) {
      console.error('Error checking SD card:', error);
      setHasSDCard(false);
      setSdCardStorage('Not inserted');
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check and request permissions on app start
        const permissions = await checkAndRequestPermissions();
        setPermissionsGranted(permissions);
        
        // Check for full file access
        const fullAccess = await hasFullFileAccess();
        setHasFullAccess(fullAccess);
        
        // Only request full access if we don't have it
        if (!fullAccess) {
          await requestFullFileAccess();
        }
        
        // Get all storage locations
        const locations = await getAllStorageLocations();
        setStorageLocations(locations);
        
        if (permissions) {
          // Only load storage info and recent files if permissions are granted
          await getStorageInfo();
          await loadRecentFiles();
          await checkSDCard(); // Add SD card check
        } else {
          // Show permission warning
          Alert.alert(
            'Permissions Required',
            'This file manager needs storage permissions to work properly. Please grant the required permissions.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();
  }, []);

  const getStorageInfo = async () => {
    try {
      // Get the internal storage path based on platform
      const internalStoragePath = Platform.OS === 'android' 
        ? '/storage/emulated/0'  // Android internal storage path
        : FileSystem.documentDirectory; // iOS uses app's document directory

      // Get storage info
      const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
      const totalDiskCapacity = await FileSystem.getTotalDiskCapacityAsync();

      setInternalStorage(
        `${formatBytesToGB(totalDiskCapacity - freeDiskStorage)} / ${formatBytesToGB(totalDiskCapacity)}`
      );

      // Store the internal storage path for later use
      if (Platform.OS === 'android') {
        // Check if we can access the internal storage
        try {
          const testPath = `${internalStoragePath}/DCIM`;
          const dirInfo = await FileSystem.getInfoAsync(testPath);
          if (!dirInfo.exists) {
            console.warn('DCIM directory not accessible');
          }
        } catch (error) {
          console.warn('Storage access error:', error);
        }
      }
    } catch (error) {
      console.error('Error getting storage info:', error);
      setInternalStorage('Error');
    }
  };

  useEffect(() => {
    loadRecentFiles();
  }, []);

  const loadRecentFiles = async () => {
    const files = await getRecentFiles();
    setRecentFiles(files);
  };

  const handleFilePress = (file: RecentFile) => {
    if (file.isFile) {
      // Handle file opening
      Alert.alert('Open File', `Would you like to open ${file.name}?`);
    } else {
      // Navigate to directory
      navigation.navigate('FileExplorer', { initialPath: file.path, title: file.name });
    }
  };

  const STORAGE_DATA = [
    {
      icon: <MaterialIcons name="phone-android" size={24} color="#6EC1E4" />,
      label: 'Internal storage', 
      value: internalStorage,
      path: RNFS.ExternalStorageDirectoryPath
    },
    {
      icon: <MaterialIcons name="sd-card" size={24} color="#B5E61D" />,
      label: 'SD card', 
      value: sdCardStorage,
      path: null
    }
  ];

  const handleStoragePress = (item: typeof STORAGE_DATA[0]) => {
    if (item.label === 'SD card') {
      if (!hasSDCard) {
            Alert.alert(
          'SD Card Not Found',
          'Please insert an SD card to access external storage.',
          [{ text: 'OK' }]
            );
            return;
          }
    }
    if (item.path) {
          navigation.navigate('FileExplorer', {
        initialPath: item.path,
        title: item.label
          });
        }
  };

  const handleCategoryPress = async (path: string, title: string) => {
    try {
      // Check permissions first
      if (!permissionsGranted) {
        const granted = await checkAndRequestPermissions();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Please grant storage permissions to access files.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
        setPermissionsGranted(true);
      }

      // Special case for Videos category
      if (title === 'Videos') {
        navigation.navigate('VideoGallery');
        return;
      }

      // Check if path is accessible
      const isAccessible = await isPathAccessible(path);
      if (!isAccessible) {
        // Check if we have full file access
        const fullAccess = await hasFullFileAccess();
        
        if (!fullAccess) {
          showFullAccessInstructions();
          return;
        } else {
          // We have full access but still can't access the path
          Alert.alert(
            'Access Denied',
            `Cannot access ${title}. This location may be restricted or not exist on your device.`,
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Navigate to the FileExplorer with the selected path
      navigation.navigate('FileExplorer', {
        initialPath: path,
        title: title
      });
    } catch (error) {
      console.error('Error accessing directory:', error);
      Alert.alert('Error', 'Could not access the selected directory.');
    }
  };

  const CATEGORIES = [
    {
      icon: <MaterialIcons name="image" size={24} color="#4CAF50" />,
      label: 'Images',
      onPress: () => navigation.navigate('ImageGallery'),
    },
    {
      icon: <MaterialIcons name="videocam" size={24} color="#F44336" />,
      label: 'Videos',
      onPress: () => navigation.navigate('VideoGallery'),
    },
    {
      icon: <MaterialIcons name="audiotrack" size={24} color="#2196F3" />,
      label: 'Audio',
      onPress: () => navigation.navigate('AudioGallery'),
    },
    {
      icon: <MaterialIcons name="description" size={24} color="#FFC107" />,
      label: 'Documents',
      onPress: () => navigation.navigate('DocumentGallery'),
    },
    {
      icon: <MaterialIcons name="archive" size={24} color="#9C27B0" />,
      label: 'Downloads',
      onPress: () => navigation.navigate('DownloadsGallery'),
    },
    {
      icon: <MaterialIcons name="android" size={24} color="#4CAF50" />,
      label: 'APK',
      onPress: () => navigation.navigate('ApkGallery'),
    },
  ];

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchItems(FileSystem.documentDirectory || '', query);
      // Convert string paths to file info objects
      const fileItems = await Promise.all(
        results.map(async (path) => {
          const info = await FileSystem.getInfoAsync(path);
          let itemCount = undefined;
          let size = undefined;
          let modificationTime = undefined;

          if (info.exists) {
            if (info.isDirectory) {
              try {
                const subItems = await FileSystem.readDirectoryAsync(path);
                itemCount = subItems.length;
              } catch (subDirError) {
                console.warn(`Could not read subdirectory ${path}:`, subDirError);
                itemCount = 0;
              }
            } else {
              size = info.size;
              modificationTime = info.modificationTime;
            }
          }

          return {
            name: path.split('/').pop() || '',
            path,
            isFile: info.exists && !info.isDirectory,
            size,
            modificationTime,
            itemCount,
          };
        })
      );
      setSearchResults(fileItems);
    } catch (error: any) {
      Alert.alert('Error', `Failed to search: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const renderSearchModal = () => (
    <Modal
      visible={isSearchModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setIsSearchModalVisible(false);
        setSearchQuery('');
        setSearchResults([]);
      }}
    >
      <View style={styles.searchModalContainer}>
        <View style={styles.searchModalContent}>
          <View style={styles.searchHeader}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search files and folders..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                performSearch(text);
              }}
              autoFocus
            />
            <TouchableOpacity 
              style={styles.searchCloseButton}
              onPress={() => {
                setIsSearchModalVisible(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {isSearching ? (
            <ActivityIndicator size="large" color="#6EC1E4" style={styles.searchLoader} />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.path}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => {
                    setIsSearchModalVisible(false);
                    navigation.navigate('FileExplorer', {
                      initialPath: item.path,
                      title: item.name
                    });
                  }}
                >
                  <MaterialIcons
                    name={item.isFile ? 'insert-drive-file' : 'folder'}
                    size={24}
                    color={item.isFile ? '#ccc' : '#6EC1E4'}
                    style={styles.searchResultIcon}
                  />
                  <View style={styles.searchResultContent}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultPath}>{item.path}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="search" size={48} color="#555" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'No results found' : 'Start typing to search...'}
                  </Text>
                </View>
              }
              contentContainerStyle={styles.searchResultsList}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderRecentFile = ({ item }: { item: RecentFile }) => (
    <TouchableOpacity
      style={styles.recentFileItem}
      onPress={() => handleFilePress(item)}
    >
      <Ionicons
        name={item.isFile ? 'document' : 'folder'}
        size={24}
        color="#007AFF"
      />
      <View style={styles.recentFileInfo}>
        <Text style={styles.recentFileName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.recentFileDetails}>
          {item.isFile ? formatFileSize(item.size || 0) : 'Folder'} • 
          {new Date(item.lastAccessed).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
    </TouchableOpacity>
  );

  const listFiles = async () => {
    try {
      const files = await RNFS.readDir('/storage/emulated/0/');
      console.log('Files:', files);
      Alert.alert('Files', files.map(f => f.name).join('\n'));
    } catch (error) {
      console.error('Error listing files:', error);
      Alert.alert('Error', 'Could not list files from root storage.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#111' }]}> {/* Force dark background */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>My Files</Text>

        {/* Permission Status Indicator */}
        {!permissionsGranted && (
          <View style={styles.permissionWarning}>
            <MaterialIcons name="warning" size={20} color="#FF9500" />
            <Text style={styles.permissionWarningText}>
              Storage permissions required for full functionality
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={async () => {
                const granted = await checkAndRequestPermissions();
                if (granted) {
                  setPermissionsGranted(true);
                  await getStorageInfo();
                  await loadRecentFiles();
                }
              }}
            >
              <Text style={styles.permissionButtonText}>Grant Permissions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Full Access Status Indicator */}
        {permissionsGranted && !hasFullAccess && (
          <View style={[styles.permissionWarning, { backgroundColor: '#007AFF' }]}>
            <MaterialIcons name="info" size={20} color="#fff" />
            <Text style={[styles.permissionWarningText, { color: '#fff' }]}>
              Enable "All files access" for complete file manager
            </Text>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: '#fff' }]}
              onPress={async () => {
                showFullAccessInstructions();
                const fullAccess = await hasFullFileAccess();
                setHasFullAccess(fullAccess);
              }}
            >
              <Text style={[styles.permissionButtonText, { color: '#007AFF' }]}>Enable</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search and Recent files buttons */}
        {/* <View style={styles.topButtonsContainer}>
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => setIsSearchModalVisible(true)}
          >
            <MaterialIcons name="search" size={22} color="#6EC1E4" />
            <Text style={styles.searchBtnText}>Search files</Text>
          </TouchableOpacity>
        </View> */}
        <View style={styles.topButtonsContainer}>
          <TouchableOpacity 
            style={styles.searchBtn}
            onPress={() => navigation.navigate('SearchScreen')}
          >
            <MaterialIcons name="search" size={22} color="#6EC1E4" />
            <Text style={styles.searchBtnText}>Search files</Text>
          </TouchableOpacity>
        </View>

        {/* Categories grid */}
        <View style={styles.categoriesSection}>
          {CATEGORIES.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.categoryBtn} onPress={item.onPress}>
              {item.icon}
              <Text style={styles.categoryLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Storage section */}
        <View style={styles.storageSection}>
          {STORAGE_DATA.map((item, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={[
                styles.storageCard,
                !item.path && styles.disabledStorageCard
              ]}
              onPress={() => handleStoragePress(item)}
            >
              {item.icon}
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.storageLabel}>{item.label}</Text>
                <Text style={styles.storageValue}>
                  {item.label === 'SD card' && !hasSDCard ? 'Mount an SD card' : item.value}
                </Text>
              </View>
          </TouchableOpacity>
          ))}
        </View>

        {/* Recycle bin & Analyse storage */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={() => navigation.navigate('RecycleBin')}
          >
            <MaterialIcons name="delete" size={22} color="#B5E61D" />
            <Text style={styles.bottomBtnText}>Recycle bin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={() => {
              if (Platform.OS === 'android') {
                Linking.sendIntent('android.settings.INTERNAL_STORAGE_SETTINGS');
              } else {
                Alert.alert('Not Available', 'This feature is only available on Android devices.');
              }
            }}
          >
            <Ionicons name="search" size={22} color="#6EC1E4" />
            <Text style={styles.bottomBtnText}>Analyse storage</Text>
          </TouchableOpacity>
        </View>

        {renderSearchModal()}

        <View style={styles.recentFilesSection}>
          <Text style={styles.recentFilesTitle}>Recent Files</Text>
          {recentFiles.length > 0 ? (
            recentFiles.map((file) => renderRecentFile({ item: file }))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color="#8E8E93" />
              <Text style={styles.emptyText}>No recent files</Text>
            </View>
          )}
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
  topButtonsContainer: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 18,
    gap: 12,
  },
  searchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 17,
    marginLeft: 12,
    fontWeight: '500',
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
  searchModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  searchModalContent: {
    flex: 1,
    marginTop: 50,
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 15,
    color: '#fff',
    fontSize: 16,
  },
  searchCloseButton: {
    marginLeft: 10,
    padding: 5,
  },
  searchLoader: {
    marginTop: 20,
  },
  searchResultsList: {
    paddingBottom: 20,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  searchResultIcon: {
    marginRight: 15,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  searchResultPath: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyText: {
    color: '#555',
    fontSize: 16,
    marginTop: 12,
  },
  recentFilesSection: {
    marginHorizontal: 12,
    marginTop: 28,
  },
  recentFilesTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  recentFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  recentFileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recentFileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  recentFileDetails: {
    fontSize: 14,
    color: '#8E8E93',
  },
  permissionWarning: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 12,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionWarningText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  permissionButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  iconButton: {
    padding: 8,
  },
  disabledStorageCard: {
    opacity: 0.7,
  },
});

export default HomeScreen; 