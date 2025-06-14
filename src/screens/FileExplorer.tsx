import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, Dimensions, Platform, TouchableWithoutFeedback, Modal, TextInput } from 'react-native';
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

type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

interface FileItem {
  name: string;
  path: string;
  isFile: boolean;
  size?: number; // Bytes
  modificationTime?: number; // Unix timestamp
  itemCount?: number; // For directories
}

const { width, height } = Dimensions.get('window');

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

interface DropdownProps {
  isVisible: boolean;
  options: { label: string; onPress: () => void; isDestructive?: boolean; icon?: MaterialIconName }[];
  onClose: () => void;
  position: { top: number; left: number };
}

const Dropdown: React.FC<DropdownProps> = ({ isVisible, options, onClose, position }) => {
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    if (isVisible) {
      Animated.spring(animation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      animation.setValue(0);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.dropdownOverlay}>
        <Animated.View 
          style={[
            styles.dropdownContainer, 
            { 
              top: position.top, 
              left: position.left,
              transform: [{
                scale: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              }],
              opacity: animation,
            }
          ]}
        >
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dropdownOption,
                index === options.length - 1 && styles.dropdownOptionLast
              ]}
              onPress={() => {
                option.onPress();
                onClose();
              }}
            >
              <View style={styles.dropdownOptionContent}>
                {option.icon && (
                  <MaterialIcons 
                    name={option.icon} 
                    size={20} 
                    color={option.isDestructive ? '#ff4444' : '#6EC1E4'} 
                    style={styles.dropdownOptionIcon} 
                  />
                )}
                <Text style={[
                  styles.dropdownOptionText,
                  option.isDestructive && styles.dropdownOptionTextDestructive
                ]}>
                  {option.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
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

  const moreOptionsButtonRef = useRef<View>(null);
  const [showMoreOptionsDropdown, setShowMoreOptionsDropdown] = useState(false);
  const [moreOptionsDropdownPosition, setMoreOptionsDropdownPosition] = useState({ top: 0, left: 0 });

  const fileItemActionDropdownRef = useRef<View>(null);
  const [showFileItemActionDropdown, setShowFileItemActionDropdown] = useState(false);
  const [fileItemActionDropdownPosition, setFileItemActionDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedFileItemForActions, setSelectedFileItemForActions] = useState<FileItem | null>(null);

  const sortFilterButtonRef = useRef<View>(null);
  const [showSortFilterDropdown, setShowSortFilterDropdown] = useState(false);
  const [sortFilterDropdownPosition, setSortFilterDropdownPosition] = useState({ top: 0, left: 0 });
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modificationTime'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const toggleTheme = () => {
    setThemeType(themeType === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath, sortBy, sortOrder]);

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
      
      // Sort files based on sortBy and sortOrder
      fileItems.sort((a, b) => {
        // Folders always come first, regardless of sort criteria
        if (a.isFile !== b.isFile) {
          return a.isFile ? 1 : -1;
        }

        let comparison = 0;
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'size') {
          // For folders, use itemCount for size comparison (more items = larger)
          const aSize = a.isFile ? a.size || 0 : a.itemCount || 0;
          const bSize = b.isFile ? b.size || 0 : b.itemCount || 0;
          comparison = aSize - bSize;
        } else if (sortBy === 'modificationTime') {
          comparison = (a.modificationTime || 0) - (b.modificationTime || 0);
        }

        return sortOrder === 'asc' ? comparison : -comparison;
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
      // Handle file press - open file or show options via dropdown
      setSelectedFileItemForActions(item);
      setShowFileItemActionDropdown(true);
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
    setShowMoreOptionsDropdown(false); // Close dropdown
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
    setShowMoreOptionsDropdown(false); // Close dropdown
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
    setShowFileItemActionDropdown(false); // Close dropdown
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
    setShowFileItemActionDropdown(false); // Close dropdown
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
    setIsSearchModalVisible(true);
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchItems(currentPath, query);
      // Convert string paths to FileItem objects
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

  const handleMoreOptions = () => {
    if (moreOptionsButtonRef.current) {
      (moreOptionsButtonRef.current as any).measureInWindow((x: number, y: number, width: number, height: number) => {
        setMoreOptionsDropdownPosition({ top: y + height, left: x });
        setShowMoreOptionsDropdown(true);
      });
    }
  };

  const handleLongPressItem = (item: FileItem) => {
    setSelectedFileItemForActions(item);
    setShowFileItemActionDropdown(true);
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
            <View ref={moreOptionsButtonRef} collapsable={false}>
              <MaterialIcons name="more-vert" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSortFilterBar = () => (
    <View style={styles.sortFilterBar}>
      <TouchableOpacity onPress={() => {
        if (sortFilterButtonRef.current) {
          (sortFilterButtonRef.current as any).measureInWindow((x: number, y: number, width: number, height: number) => {
            // Adjust position to ensure dropdown is within screen bounds if it opens near the right edge
            const adjustedLeft = x; // Keep left as is, dropdown has minWidth
            setSortFilterDropdownPosition({ top: y + height, left: adjustedLeft });
            setShowSortFilterDropdown(true);
          });
        }
      }} style={styles.sortFilterButton}>
        <View ref={sortFilterButtonRef} collapsable={false}>
          <Text style={styles.sortFilterText}>Sort by: {sortBy === 'modificationTime' ? 'Date' : sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}</Text>
          <MaterialIcons name="arrow-drop-down" size={20} color="#fff" />
        </View>
      </TouchableOpacity>
      <View style={styles.sortOptions}>
        <TouchableOpacity onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} style={styles.sortFilterButton}>
          <MaterialIcons name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sortFilterButton}>
          <MaterialIcons name="grid-view" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: FileItem }) => (
    <TouchableOpacity
      onPress={() => {
        if (item.isFile) {
          openFolder(item);
        }
      }}
      onLongPress={() => handleLongPressItem(item)}
      style={styles.itemContainer}
    >
      <View style={styles.itemIconContainer}>
        {item.isFile ? (
          <MaterialIcons name="insert-drive-file" size={28} color="#ccc" />
        ) : (
          <MaterialIcons name={getFolderIcon(item.name)} size={28} color="#6EC1E4" />
        )}
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemDetailsContainer}>
          {item.modificationTime && (
            <View style={styles.itemDetail}>
              <MaterialIcons name="access-time" size={14} color="#666" />
              <Text style={styles.itemDetails}>{formatDate(item.modificationTime)}</Text>
            </View>
          )}
          {!item.isFile && item.itemCount !== undefined && (
            <View style={styles.itemDetail}>
              <MaterialIcons name="folder" size={14} color="#666" />
              <Text style={styles.itemDetails}>{item.itemCount} items</Text>
            </View>
          )}
          {item.isFile && item.size !== undefined && (
            <View style={styles.itemDetail}>
              <MaterialIcons name="storage" size={14} color="#666" />
              <Text style={styles.itemDetails}>{formatBytesToGB(item.size)}</Text>
            </View>
          )}
        </View>
      </View>
      {!item.isFile && (
        <MaterialIcons name="chevron-right" size={24} color="#555" />
      )}
    </TouchableOpacity>
  );

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
              renderItem={renderItem}
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
      <Dropdown
        isVisible={showMoreOptionsDropdown}
        options={[
          { label: 'Create New Folder', onPress: handleNewFolder, icon: 'create-new-folder' as MaterialIconName },
          { label: 'Create New File', onPress: handleNewFile, icon: 'note-add' as MaterialIconName },
          { label: 'Copy', onPress: () => Alert.alert('Copy', 'Copy functionality not yet implemented.'), icon: 'content-copy' as MaterialIconName },
          { label: 'Move', onPress: () => Alert.alert('Move', 'Move functionality not yet implemented.'), icon: 'drive-file-move' as MaterialIconName },
        ]}
        onClose={() => setShowMoreOptionsDropdown(false)}
        position={moreOptionsDropdownPosition}
      />

      {selectedFileItemForActions && (
        <Dropdown
          isVisible={showFileItemActionDropdown}
          options={[
            ...(selectedFileItemForActions.isFile ? [
              { label: 'Open', onPress: () => console.log('Open file', selectedFileItemForActions.name), icon: 'open-in-new' as MaterialIconName },
              { label: 'Share', onPress: () => console.log('Share file', selectedFileItemForActions.name), icon: 'share' as MaterialIconName },
            ] : []),
            { label: 'Rename', onPress: () => handleRenameItem(selectedFileItemForActions), icon: 'edit' as MaterialIconName },
            { label: 'Delete', onPress: () => handleDeleteItem(selectedFileItemForActions), isDestructive: true, icon: 'delete' as MaterialIconName },
            { label: 'Copy', onPress: () => Alert.alert('Copy', 'Copy functionality not yet implemented.'), icon: 'content-copy' as MaterialIconName },
            { label: 'Move', onPress: () => Alert.alert('Move', 'Move functionality not yet implemented.'), icon: 'drive-file-move' as MaterialIconName },
          ]}
          onClose={() => setShowFileItemActionDropdown(false)}
          position={fileItemActionDropdownPosition}
        />
      )}

      <Dropdown
        isVisible={showSortFilterDropdown}
        options={[
          { label: 'Name', onPress: () => { setSortBy('name'); setSortOrder('asc'); }, icon: 'sort-by-alpha' as MaterialIconName },
          { label: 'Size', onPress: () => { setSortBy('size'); setSortOrder('desc'); }, icon: 'storage' as MaterialIconName },
          { label: 'Date', onPress: () => { setSortBy('modificationTime'); setSortOrder('desc'); }, icon: 'event' as MaterialIconName },
        ]}
        onClose={() => setShowSortFilterDropdown(false)}
        position={sortFilterDropdownPosition}
      />

      {renderSearchModal()}
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
  itemDetailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8,
  },
  itemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemDetails: {
    color: '#666',
    fontSize: 12,
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
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dropdownContainer: {
    position: 'absolute',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownOptionIcon: {
    marginRight: 12,
  },
  dropdownOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownOptionTextDestructive: {
    color: '#ff4444',
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
});

export default FileExplorer; 