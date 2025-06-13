import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, Dimensions, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeContext } from '../utils/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatBytesToGB, createFolder, createFile, renameItem, deleteItem, searchItems } from '../utils/FileManagement';

type RootStackParamList = {
  Home: undefined;
  FileExplorer: { initialPath: string; title: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FileExplorerRouteProp = RouteProp<RootStackParamList, 'FileExplorer'>;

interface FileItem {
  name: string;
  path: string;
  isFile: boolean;
  size?: number; // Bytes
  modificationTime?: number; // Unix timestamp
  itemCount?: number; // For directories
}

const { width } = Dimensions.get('window');

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return date.toLocaleString('en-US', options);
};

const getFolderIcon = (folderName: string) => {
  switch (folderName.toLowerCase()) {
    case 'android': return 'android';
    case 'documents': return 'description';
    case 'download': return 'file-download';
    case 'movies': return 'movie';
    case 'music': return 'music-note';
    case 'pictures': return 'image';
    case 'alarms': return 'alarm';
    case 'audiobooks': return 'book';
    case 'dcim': return 'camera-alt';
    case 'downloadhelper': return 'cloud-download';
    case 'notifications': return 'notifications';
    default: return 'folder';
  }
};

const FileExplorer: React.FC = () => {
  const route = useRoute<FileExplorerRouteProp>();
  const insets = useSafeAreaInsets();
  const { theme, themeType, setThemeType } = useThemeContext();
  const [currentPath, setCurrentPath] = useState(route.params?.initialPath || FileSystem.documentDirectory || '');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const scrollY = new Animated.Value(0);
  const navigation = useNavigation<NavigationProp>();

  const toggleTheme = () => {
    setThemeType(themeType === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const items = await FileSystem.readDirectoryAsync(path);

      const fileItems = await Promise.all(
        items.map(async (name) => {
          const fullPath = `${path.endsWith('/') ? path : path + '/'}${name}`;
          const info = await FileSystem.getInfoAsync(fullPath);
          let itemCount = undefined;
          let size = undefined;
          let modificationTime = undefined;

          if (info.exists) {
            if (info.isDirectory) {
              try {
                const subItems = await FileSystem.readDirectoryAsync(fullPath);
                itemCount = subItems.length;
              } catch (subDirError) {
                console.warn(`Could not read subdirectory ${fullPath}:`, subDirError);
                itemCount = 0; // Assume 0 if not readable due to permissions etc.
              }
            } else { // It's a file
              size = info.size;
              modificationTime = info.modificationTime;
            }
          }

          return {
            name,
            path: fullPath,
            isFile: info.exists && !info.isDirectory,
            size,
            modificationTime,
            itemCount,
          };
        })
      );
      
      // Sort folders first, then files, then alphabetically
      fileItems.sort((a, b) => {
        if (a.isFile !== b.isFile) {
          return a.isFile ? 1 : -1; // Folders come before files
        }
        return a.name.localeCompare(b.name); // Sort alphabetically
      });

      setFiles(fileItems);
    } catch (error) {
      console.error('Error loading files:', error);
      Alert.alert('Error', 'Failed to load files. Please try again.');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const openFolder = (item: FileItem) => {
    if (!item.isFile) {
      setHistory([...history, currentPath]);
      setCurrentPath(item.path);
      navigation.setOptions({ title: item.name }); // Update header title dynamically
    } else {
      // Handle file press - open file or show options
      Alert.alert(
        `Open ${item.name}`,
        'What would you like to do with this file?',
        [
          { text: 'Open', onPress: () => console.log('Open file', item.name) },
          { text: 'Share', onPress: () => console.log('Share file', item.name) },
          { text: 'Delete', onPress: () => handleDeleteItem(item) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setCurrentPath(prev);
      // Update header title based on the new path
      const prevTitle = prev.split('/').pop() || 'Root';
      navigation.setOptions({ title: prevTitle });
    } else {
      navigation.goBack(); // If no history, go back to the previous screen (Home)
    }
  };

  const handleNewFolder = () => {
    Alert.prompt(
      'Create New Folder',
      'Enter folder name:',
      async (folderName) => {
        if (folderName) {
          try {
            await createFolder(currentPath, folderName);
            loadFiles(currentPath); // Reload files after creation
          } catch (error: any) {
            Alert.alert('Error', `Failed to create folder: ${error.message}`);
          }
        }
      },
      'plain-text'
    );
  };

  const handleNewFile = () => {
    Alert.prompt(
      'Create New File',
      'Enter file name:',
      async (fileName) => {
        if (fileName) {
          try {
            await createFile(currentPath, fileName);
            loadFiles(currentPath); // Reload files after creation
          } catch (error: any) {
            Alert.alert('Error', `Failed to create file: ${error.message}`);
          }
        }
      },
      'plain-text'
    );
  };

  const handleRenameItem = (item: FileItem) => {
    Alert.prompt(
      `Rename ${item.name}`,
      'Enter new name:',
      async (newName) => {
        if (newName && newName !== item.name) {
          const newPath = `${item.path.substring(0, item.path.lastIndexOf('/') + 1)}${newName}`;
          try {
            await renameItem(item.path, newPath);
            loadFiles(currentPath); // Reload files after rename
          } catch (error: any) {
            Alert.alert('Error', `Failed to rename: ${error.message}`);
          }
        }
      },
      'plain-text',
      item.name
    );
  };

  const handleDeleteItem = (item: FileItem) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${item.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteItem(item.path);
              loadFiles(currentPath); // Reload files after deletion
            } catch (error: any) {
              Alert.alert('Error', `Failed to delete: ${error.message}`);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleSearch = () => {
    Alert.prompt(
      'Search Files/Folders',
      'Enter search query:',
      async (query) => {
        if (query) {
          try {
            const results = await searchItems(currentPath, query);
            if (results.length > 0) {
              Alert.alert('Search Results', `Found ${results.length} items:\n\n${results.join('\n')}`);
            } else {
              Alert.alert('Search Results', 'No items found matching your query.');
            }
            // For a more integrated search, you'd filter the 'files' state directly
            // For simplicity, we are just showing an alert with results
          } catch (error: any) {
            Alert.alert('Error', `Failed to search: ${error.message}`);
          }
        }
      },
      'plain-text'
    );
  };

  const handleMoreOptions = () => {
    Alert.alert(
      'Options',
      'Choose an action:',
      [
        { text: 'Create New Folder', onPress: handleNewFolder },
        { text: 'Create New File', onPress: handleNewFile },
        { text: 'Copy', onPress: () => Alert.alert('Copy', 'Copy functionality not yet implemented.') },
        { text: 'Move', onPress: () => Alert.alert('Move', 'Move functionality not yet implemented.') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderHeader = () => (
    <View style={[
      styles.header,
      { paddingTop: insets.top, backgroundColor: '#000' } // Force dark background
    ]}>
      <View style={styles.headerTopBar}>
        <TouchableOpacity onPress={goBack} style={styles.headerIconBtn}>
          <MaterialIcons name="arrow-back-ios" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.currentPathContainer}>
          <MaterialIcons name="home" size={20} color="#6EC1E4" style={{ marginRight: 5 }} />
          <Text style={styles.currentPathText}>
            {route.params?.title || currentPath.split('/').filter(Boolean).pop() || 'Internal storage'}
          </Text>
        </View>
        <View style={styles.headerRightIcons}>
          <TouchableOpacity onPress={handleSearch} style={styles.headerIconBtn}>
            <MaterialIcons name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMoreOptions} style={styles.headerIconBtn}>
            <MaterialIcons name="more-vert" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSortFilterBar = () => (
    <View style={styles.sortFilterBar}>
      <TouchableOpacity style={styles.sortFilterButton}>
        <Text style={styles.sortFilterText}></Text>
        <MaterialIcons name="arrow-drop-down" size={20} color="#fff" />
      </TouchableOpacity>
      <View style={styles.sortOptions}>
        <TouchableOpacity style={styles.sortFilterButton}>
          <Text style={styles.sortFilterText}>Name</Text>
          <MaterialIcons name="arrow-upward" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sortFilterButton}>
          <MaterialIcons name="sort" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sortFilterButton}>
          <MaterialIcons name="grid-view" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: FileItem }) => (
    <TouchableOpacity
      onPress={() => openFolder(item)}
      onLongPress={() => handleLongPressItem(item)} // Add long press handler
      style={styles.itemContainer}
    >
      <View style={styles.itemIconContainer}>
        {item.isFile ? (
          // For special patterned files, you'd use a custom Image component if assets are available
          // For now, using a generic file icon
          <MaterialIcons name="insert-drive-file" size={28} color="#ccc" />
        ) : (
          <MaterialIcons name={getFolderIcon(item.name)} size={28} color="#6EC1E4" />
        )}
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemDetails}>
          {item.modificationTime ? formatDate(item.modificationTime) : ''}
          {!item.isFile && item.itemCount !== undefined && ` • ${item.itemCount} items`}
          {item.isFile && item.size !== undefined && ` • ${formatBytesToGB(item.size)}`}
        </Text>
      </View>
      {!item.isFile && (
        <MaterialIcons name="chevron-right" size={24} color="#555" />
      )}
    </TouchableOpacity>
  );

  // New function to handle long press on items
  const handleLongPressItem = (item: FileItem) => {
    Alert.alert(
      `Actions for ${item.name}`,
      'Choose an action:',
      [
        { text: 'Rename', onPress: () => handleRenameItem(item) },
        { text: 'Delete', onPress: () => handleDeleteItem(item) },
        { text: 'Copy', onPress: () => Alert.alert('Copy', 'Copy functionality not yet implemented.') },
        { text: 'Move', onPress: () => Alert.alert('Move', 'Move functionality not yet implemented.') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {renderHeader()}
      {renderSortFilterBar()}
      {loading ? (
        <ActivityIndicator size="large" color="#6EC1E4" style={styles.loader} />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.path}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="folder-open" size={48} color="#555" />
              <Text style={styles.emptyText}>
                No files found
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    width: '100%',
    backgroundColor: '#000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    height: 56, // Fixed height for header top bar
  },
  headerIconBtn: {
    padding: 5,
  },
  currentPathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10, // Adjust spacing from back button
  },
  currentPathText: {
    color: '#6EC1E4',
    fontSize: 16,
    fontWeight: '500',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  sortFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  sortFilterText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 5,
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#111',
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderRadius: 20,
    backgroundColor: '#333', // Placeholder background for icon circle
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  itemDetails: {
    color: '#aaa',
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
  loader: {
    marginTop: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
});

export default FileExplorer; 