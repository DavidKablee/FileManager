import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert, Modal, TextInput, FlatList, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../utils/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import { searchItems } from '../utils/FileManagement';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
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
              Alert.alert(
                'Storage Access',
                'Please grant storage permissions to access internal storage.',
                [{ text: 'OK' }]
              );
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

    getStorageInfo();
  }, []);

  const STORAGE_DATA = [
    {
      icon: <View><MaterialIcons name="smartphone" size={22} color="#6EC1E4" /></View>, 
      label: 'Internal storage', 
      value: internalStorage,
      onPress: () => navigation.navigate('FileExplorer', {
        initialPath: Platform.OS === 'android' ? '/storage/emulated/0' : FileSystem.documentDirectory || '',
        title: 'Internal Storage'
      }),
    },
    {
      icon: <View><MaterialIcons name="sd-card" size={22} color="#A084E8" /></View>, 
      label: 'SD card', 
      value: sdCardStorage,
      onPress: () => Alert.alert('SD Card', 'SD card functionality not implemented yet.')
    },
  ];

  // Function to get common directories, creating them if they don't exist
  const getCommonDirectoryPath = async (subDir: string) => {
    const baseDir = Platform.OS === 'android' 
      ? '/storage/emulated/0'  // Android internal storage path
      : FileSystem.documentDirectory; // iOS uses app's document directory

    if (!baseDir) {
      throw new Error('Storage directory not available');
    }

    const fullPath = `${baseDir}/${subDir}/`;
    const dirInfo = await FileSystem.getInfoAsync(fullPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });
    }
    return fullPath;
  };

  const CATEGORY_DATA = [
    {
      icon: <View><MaterialIcons name="image" size={28} color="#6EC1E4" /></View>, 
      label: 'Images',
      onPress: async () => navigation.navigate('FileExplorer', { 
        initialPath: Platform.OS === 'android' ? '/storage/emulated/0/DCIM' : await getCommonDirectoryPath('Pictures'), 
        title: 'Images' 
      }),
    },
    {
      icon: <View><MaterialIcons name="videocam" size={28} color="#A084E8" /></View>, 
      label: 'Videos',
      onPress: async () => navigation.navigate('FileExplorer', { 
        initialPath: Platform.OS === 'android' ? '/storage/emulated/0/Movies' : await getCommonDirectoryPath('Videos'), 
        title: 'Videos' 
      }),
    },
    {
      icon: <View><MaterialIcons name="music-note" size={28} color="#F67280" /></View>, 
      label: 'Audio files',
      onPress: async () => navigation.navigate('FileExplorer', { 
        initialPath: Platform.OS === 'android' ? '/storage/emulated/0/Music' : await getCommonDirectoryPath('Music'), 
        title: 'Audio files' 
      }),
    },
    {
      icon: <View><MaterialIcons name="description" size={28} color="#B5E61D" /></View>, 
      label: 'Documents',
      onPress: async () => navigation.navigate('FileExplorer', { 
        initialPath: Platform.OS === 'android' ? '/storage/emulated/0/Documents' : await getCommonDirectoryPath('Documents'), 
        title: 'Documents' 
      }),
    },
    {
      icon: <View><MaterialIcons name="file-download" size={28} color="#00B8A9" /></View>, 
      label: 'Downloads',
      onPress: async () => navigation.navigate('FileExplorer', { 
        initialPath: Platform.OS === 'android' ? '/storage/emulated/0/Download' : await getCommonDirectoryPath('Downloads'), 
        title: 'Downloads' 
      }),
    },
    {
      icon: <View><MaterialCommunityIcons name="android" size={28} color="#B388FF" /></View>, 
      label: 'APK\nInstallation files',
      onPress: async () => navigation.navigate('FileExplorer', { 
        initialPath: Platform.OS === 'android' ? '/storage/emulated/0/Download' : FileSystem.documentDirectory || '', 
        title: 'APK Files' 
      }),
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

  return (
    <View style={[styles.container, { backgroundColor: '#111' }]}> {/* Force dark background */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>My Files</Text>

        {/* Search and Recent files buttons */}
        <View style={styles.topButtonsContainer}>
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => setIsSearchModalVisible(true)}
          >
            <MaterialIcons name="search" size={22} color="#6EC1E4" />
            <Text style={styles.searchBtnText}>Search files</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.recentFilesBtn}
            onPress={() => navigation.navigate('FileExplorer', { initialPath: FileSystem.documentDirectory || '', title: 'Recent Files' })}
          >
            <MaterialIcons name="access-time" size={22} color="#B5E61D" />
            <Text style={styles.recentFilesText}>Recent files</Text>
          </TouchableOpacity>
        </View>

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

        {renderSearchModal()}
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
});

export default HomeScreen; 