import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, Dimensions, Platform, TouchableWithoutFeedback, Modal, TextInput, Linking, Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '../utils/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatBytesToGB, createFolder, createFile, renameItem, deleteItem, searchItems, readDirectory, isPathAccessible } from '../utils/FileManagement';
import { addToRecentFiles } from '../utils/RecentFiles';
import { LinearGradient } from 'expo-linear-gradient';
import { createThumbnail } from 'react-native-create-thumbnail';

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

const getFileIcon = (fileName: string) => {
  const extension = fileName.toLowerCase().split('.').pop();

  switch (extension) {
    // Images
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
      return { icon: 'image', color: '#4CAF50' };

    // Videos
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'mkv':
    case 'wmv':
    case 'flv':
      return { icon: 'video-file', color: '#FF5722' };

    // Audio
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'aac':
    case 'ogg':
      return { icon: 'audiotrack', color: '#9C27B0' };

    // Documents
    case 'pdf':
      return { icon: 'picture-as-pdf', color: '#F44336' };
    case 'doc':
    case 'docx':
      return { icon: 'description', color: '#2196F3' };
    case 'xls':
    case 'xlsx':
      return { icon: 'table-chart', color: '#4CAF50' };
    case 'ppt':
    case 'pptx':
      return { icon: 'slideshow', color: '#FF9800' };
    case 'txt':
      return { icon: 'article', color: '#607D8B' };

    // Archives
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return { icon: 'folder-zip', color: '#795548' };

    // APK
    case 'apk':
      return { icon: 'android', color: '#4CAF50' };

    default:
      return { icon: 'insert-drive-file', color: '#ccc' };
  }
};

const getMimeType = (fileName: string): string => {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  // Image types
  if (['jpg', 'jpeg'].includes(extension)) return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'bmp') return 'image/bmp';
  if (extension === 'webp') return 'image/webp';
  
  // Video types
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'avi') return 'video/x-msvideo';
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'mkv') return 'video/x-matroska';
  if (extension === 'wmv') return 'video/x-ms-wmv';
  if (extension === 'flv') return 'video/x-flv';
  
  // Audio types
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'flac') return 'audio/flac';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'ogg') return 'audio/ogg';
  
  // Document types
  if (extension === 'pdf') return 'application/pdf';
  if (['doc', 'docx'].includes(extension)) return 'application/msword';
  if (['xls', 'xlsx'].includes(extension)) return 'application/vnd.ms-excel';
  if (['ppt', 'pptx'].includes(extension)) return 'application/vnd.ms-powerpoint';
  if (extension === 'txt') return 'text/plain';
  
  // Archive types
  if (extension === 'zip') return 'application/zip';
  if (extension === 'rar') return 'application/x-rar-compressed';
  if (extension === '7z') return 'application/x-7z-compressed';
  if (extension === 'tar') return 'application/x-tar';
  if (extension === 'gz') return 'application/gzip';
  
  // Default
  return '*/*';
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

// Helper to get thumbnail for images/videos
const getThumbnail = async (filePath: string, mimeType: string) => {
  try {
    const asset = await MediaLibrary.createAssetAsync(filePath);
    const thumbnail = await MediaLibrary.getAssetInfoAsync(asset.id);
    return thumbnail.localUri || thumbnail.uri;
  } catch (e) {
    return null;
  }
};

// Helper to determine file type
const getFileType = (fileName: string) => {
  const ext = fileName.toLowerCase().split('.').pop() || "";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return 'image';
  if (["mp4", "avi", "mov", "mkv", "wmv", "flv"].includes(ext)) return 'video';
  if (["mp3", "wav", "flac", "aac", "ogg"].includes(ext)) return 'audio';
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(ext)) return 'document';
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return 'archive';
  if (ext === "apk") return 'apk';
  return 'other';
};

// Open file with default app, or alert if not possible
const openApk = (apkPath: string) => {
  IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    type: 'application/vnd.android.package-archive',
    data: 'file://' + apkPath,
    flags: 1,
  });
};

const openFile = async (item: FileItem) => {
  const fileUri = `file://${item.path}`;
  const fileType = getFileType(item.name);

  if (fileType === 'apk' && Platform.OS === 'android') {
    try {
      openApk(item.path);
    } catch {
      Alert.alert('No app found', 'No app to install this APK.');
    }
    return;
  }

  const canOpen = await Linking.canOpenURL(fileUri);
  if (canOpen) {
    await Linking.openURL(fileUri);
  } else {
    Alert.alert('No app found', 'No app to open this file.');
  }
};

// Add this component above FileExplorer:
const FileListItem: React.FC<{
  item: FileItem;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ item, onPress, onLongPress }) => {
  const { theme } = useThemeContext();
  const iconInfo = item.isFile ? getFileIcon(item.name) : { icon: getFolderIcon(item.name) as MaterialIconName, color: '#FFC107' };
  
  return (
    <TouchableOpacity
      style={[styles.fileItem, { backgroundColor: theme.itemBackground }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.fileIconContainer}>
        <MaterialIcons
          name={iconInfo.icon as MaterialIconName}
          size={32}
          color={iconInfo.color}
        />
      </View>
      <View style={styles.fileDetails}>
        <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.fileInfo, { color: theme.secondaryText }]}>
          {item.isFile
            ? `${item.size ? formatBytesToGB(item.size) : '0 B'} • ${
                item.modificationTime ? formatDate(item.modificationTime) : 'Unknown date'
              }`
            : `${item.itemCount || 0} items`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const FileExplorer: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'FileExplorer'>>();
  const { theme, themeType } = useThemeContext();
  const insets = useSafeAreaInsets();
  const [currentPath, setCurrentPath] = useState(route.params.initialPath);
  const [history, setHistory] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [showMoreOptionsDropdown, setShowMoreOptionsDropdown] = useState(false);
  const [showFileItemActionDropdown, setShowFileItemActionDropdown] = useState(false);
  const [showSortFilterDropdown, setShowSortFilterDropdown] = useState(false);
  const [selectedFileItemForActions, setSelectedFileItemForActions] = useState<FileItem>({} as FileItem);
  const [moreOptionsDropdownPosition, setMoreOptionsDropdownPosition] = useState({ top: 0, left: 0 });
  const [fileItemActionDropdownPosition, setFileItemActionDropdownPosition] = useState({ top: 0, left: 0 });
  const [sortFilterDropdownPosition, setSortFilterDropdownPosition] = useState({ top: 0, left: 0 });
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modificationTime'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Add state for image preview modal
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const moreOptionsButtonRef = useRef(null);
  const sortFilterButtonRef = useRef(null);

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath]);

  const loadFiles = async (path: string) => {
    setFiles([]);
    try {
      // Check if path is accessible
      const isAccessible = await isPathAccessible(path);
      if (!isAccessible) {
        Alert.alert(
          'Access Denied',
          `Cannot access ${path}. Please check permissions or try a different location.`,
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
        return;
      }

      // Use the enhanced readDirectory function
      const fileItems = await readDirectory(path);

      // Convert to the expected format
      const convertedItems: FileItem[] = fileItems.map(item => ({
        name: item.name,
        path: item.path,
        isFile: !item.isDirectory,
        size: item.size,
        modificationTime: new Date(item.modifiedTime).getTime() / 1000,
        itemCount: item.itemCount
      }));

      setFiles(convertedItems);
    } catch (error) {
      console.error('Error loading files:', error);
      Alert.alert(
        'Error',
        `Failed to load files from ${path}. Please check permissions.`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    }
  };

  const handleItemPress = async (item: FileItem) => {
    if (!item.isFile) {
      navigation.push('FileExplorer', { initialPath: item.path, title: item.name });
      return;
    }

    try {
      await addToRecentFiles(item.path);
      const extension = item.name.toLowerCase().split('.').pop() || '';
      const mimeType = getMimeType(item.name);
      
      if (Platform.OS === 'android') {
        // Check if it's an image file
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
          // First try to add it to the media library
          const asset = await MediaLibrary.createAssetAsync(item.path);
          // Then open the gallery
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: asset.uri,
            type: 'image/*',
            flags: 1 | 2  // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
          });
        } else {
          const fileUri = `file://${item.path}`;
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: fileUri,
            type: mimeType,
            flags: 1  // FLAG_GRANT_READ_URI_PERMISSION
          });
        }
      } else {
        // For iOS, we use Linking
        const fileUri = `file://${item.path}`;
        const supported = await Linking.canOpenURL(fileUri);
        if (!supported) {
          Alert.alert('Error', 'No app found to open this type of file');
          return;
        }
        await Linking.openURL(fileUri);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Failed to open file. Please make sure you have an app installed that can open this type of file.');
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

  const handleOpenDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      // DocumentPickerResult fix
      if (!result.canceled) {
        const successResult = result as any;
        // Add the picked document to the current directory
        const newFile: FileItem = {
          name: successResult.name || successResult.file?.name || '',
          path: successResult.uri || successResult.file?.uri || '',
          isFile: true,
          size: successResult.size || successResult.file?.size || 0,
          modificationTime: Date.now() / 1000
        };
        setFiles(prevFiles => [...prevFiles, newFile]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  // Helper to check if a file is an image
  const isImageFile = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '');
  };

  // Helper to check if current folder is an image folder
  const isImageFolder = files.length > 0 && files.every(f => f.isFile && isImageFile(f.name));

  // Image preview modal
  const renderImagePreviewModal = () => (
    <Modal visible={imagePreviewVisible} transparent animationType="fade" onRequestClose={() => setImagePreviewVisible(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 2 }} onPress={() => setImagePreviewVisible(false)}>
          <MaterialIcons name="close" size={32} color="#fff" />
        </TouchableOpacity>
        {previewImageUri && (
          <Image source={{ uri: previewImageUri }} style={{ width: '90%', height: '80%', resizeMode: 'contain' }} />
        )}
      </View>
    </Modal>
  );

  // --- HEADER ---
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={goBack} style={styles.headerButton}>
          <MaterialIcons name="arrow-back" size={24} color="#6EC1E4" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {currentPath.split('/').pop() || 'Files'}
        </Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={handleSearch} style={styles.headerButton}>
          <MaterialIcons name="search" size={24} color="#6EC1E4" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNewFile} style={styles.headerButton}>
          <MaterialIcons name="note-add" size={24} color="#6EC1E4" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNewFolder} style={styles.headerButton}>
          <MaterialIcons name="create-new-folder" size={24} color="#6EC1E4" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOpenDocument} style={styles.headerButton}>
          <MaterialIcons name="upload-file" size={24} color="#6EC1E4" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMoreOptions} style={styles.headerButton}>
          <MaterialIcons name="more-vert" size={24} color="#6EC1E4" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // --- SORT/FILTER BAR ---
  const renderSortFilterBar = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#111' }}>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#181818', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 }}>
        <Text style={{ color: '#fff', fontSize: 15, marginRight: 4 }}>All</Text>
        <MaterialIcons name="arrow-drop-down" size={20} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <MaterialIcons name="sort" size={20} color="#aaa" style={{ marginRight: 2 }} />
      <Text style={{ color: '#fff', fontSize: 15, marginRight: 2 }}>Name</Text>
      <MaterialIcons name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} size={18} color="#aaa" />
    </View>
  );

  // --- FILE/FOLDER LIST ---
  const renderFileList = () => (
    <FlatList
      data={files}
      key={'file-list'}
      contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 }}
      renderItem={({ item }) => (
        <FileListItem
          item={item}
          onPress={() => {
            if (item.isFile) {
              openFile(item);
            } else {
              openFolder(item);
            }
          }}
          onLongPress={() => handleLongPressItem(item)}
        />
      )}
      keyExtractor={item => item.path}
    />
  );

  // --- MAIN RENDER ---
  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      {renderHeader()}
      {renderSortFilterBar()}
      {renderFileList()}
      {renderImagePreviewModal()}
      {renderSortFilterBar()}
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

      {showFileItemActionDropdown && (
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
          <LinearGradient
            colors={['#000000', '#1a1a1a']}
            style={styles.searchModalContent}
          >
            <View style={styles.searchHeader}>
              <View style={styles.searchInputContainer}>
                <MaterialIcons name="search" size={20} color="#6EC1E4" style={styles.searchIcon} />
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
              </View>
              <TouchableOpacity
                style={styles.searchCloseButton}
                onPress={() => {
                  setIsSearchModalVisible(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <MaterialIcons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {isSearching ? (
              <View style={styles.searchLoaderContainer}>
                <ActivityIndicator size="large" color="#6EC1E4" />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: '#222', marginBottom: 8 }}
                    onPress={() => openFolder(item)}
                    onLongPress={() => handleLongPressItem(item)}
                  >
                    {item.isFile ? (
                      <MaterialCommunityIcons name={getFileIcon(item.name).icon as any} size={28} color={getFileIcon(item.name).color} style={{ marginRight: 16 }} />
                    ) : (
                      <MaterialIcons name={getFolderIcon(item.name)} size={28} color="#6EC1E4" style={{ marginRight: 16 }} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 16 }} numberOfLines={1}>{item.name}</Text>
                      <Text style={{ color: '#aaa', fontSize: 12 }}>
                        {item.isFile
                          ? (item.size ? `${(item.size / 1024).toFixed(1)} KB` : '') + (item.modificationTime ? ` • ${formatDate(item.modificationTime)}` : '')
                          : `${item.itemCount || 0} items${item.modificationTime ? ` • ${formatDate(item.modificationTime)}` : ''}`}
                      </Text>
                    </View>
                    {!item.isFile && <MaterialIcons name="chevron-right" size={24} color="#555" />}
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.path}
                contentContainerStyle={styles.searchResultsList}
              />
            )}
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    marginLeft: 8,
    color: '#333',
  },
  fileItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
  },
  fileInfo: {
    fontSize: 12,
    marginTop: 4,
  },
  sortFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sortFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  sortButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortFilterText: {
    color: '#6EC1E4',
    fontSize: 14,
    fontWeight: '500',
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortOptionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    marginHorizontal: 15,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: '#111',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  itemTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  itemIconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDetailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemDetails: {
    color: '#888',
    fontSize: 12,
  },
  chevronContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  loader: {
    marginTop: 20,
  },
  listContent: {
    paddingVertical: 10,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dropdownContainer: {
    position: 'absolute',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    paddingHorizontal: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  searchCloseButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  searchLoaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  searchingText: {
    color: '#6EC1E4',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  searchResultsList: {
    paddingBottom: 20,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default FileExplorer; 