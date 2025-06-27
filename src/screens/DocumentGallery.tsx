import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, Modal, Share, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatFileSize } from '../utils/FileManagement';
import * as RNFS from 'react-native-fs';
import * as IntentLauncher from 'expo-intent-launcher';

type RootStackParamList = {
  Home: undefined;
  RecycleBin: undefined;
  DocumentGallery: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type DocumentItem = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  type: string;
};

type BatchResult = {
  items: DocumentItem[];
  hasMore: boolean;
};

type IconName = keyof typeof MaterialIcons.glyphMap;

const getDocumentIcon = (type: string): { name: IconName; color: string } => {
  switch (type.toLowerCase()) {
    case 'pdf':
      return { name: 'picture-as-pdf', color: '#FF5252' };
    case 'doc':
    case 'docx':
      return { name: 'description', color: '#2196F3' };
    case 'xls':
    case 'xlsx':
      return { name: 'table-chart', color: '#4CAF50' };
    case 'ppt':
    case 'pptx':
      return { name: 'slideshow', color: '#FF9800' };
    case 'txt':
      return { name: 'text-snippet', color: '#757575' };
    default:
      return { name: 'insert-drive-file', color: '#9E9E9E' };
  }
};

const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'];
const BATCH_SIZE = 50;

const DocumentGallery = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedAll, setLoadedAll] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const loadDocumentBatch = useCallback(async (startIndex: number): Promise<BatchResult> => {
    try {
      const directories = [
        RNFS.DownloadDirectoryPath,
        RNFS.ExternalStorageDirectoryPath + '/Documents',
        RNFS.ExternalStorageDirectoryPath + '/Download'
      ];

      let allFiles: DocumentItem[] = [];
      
      for (const dir of directories) {
        try {
          const files = await RNFS.readDir(dir);
          const documentFiles = files.filter(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            return DOCUMENT_EXTENSIONS.includes(ext || '');
          });

          const items = documentFiles.map(file => ({
            name: file.name,
            path: file.path,
            size: file.size,
            modifiedTime: new Date(file.mtime || Date.now()).toISOString(),
            type: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN'
          }));

          allFiles = [...allFiles, ...items];
        } catch (error) {
          console.warn(`Error reading directory ${dir}:`, error);
        }
      }

      // Remove duplicates based on file name and size
      const uniqueFiles = Array.from(
        new Map(allFiles.map(file => [`${file.name}-${file.size}`, file])).values()
      );

      // Sort by modified time
      uniqueFiles.sort((a, b) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      const batchEnd = Math.min(startIndex + BATCH_SIZE, uniqueFiles.length);
      const batch = uniqueFiles.slice(startIndex, batchEnd);

      return {
        items: batch,
        hasMore: batchEnd < uniqueFiles.length
      };
    } catch (error) {
      console.error('Error loading document batch:', error);
      return { items: [], hasMore: false };
    }
  }, []);

  const loadInitialDocuments = useCallback(async () => {
    setIsLoading(true);
    const result = await loadDocumentBatch(0);
    setDocuments(result.items);
    setLoadedAll(!result.hasMore);
    const totalDocsSize = result.items.reduce((acc: number, curr: DocumentItem) => acc + curr.size, 0);
    setTotalSize(totalDocsSize);
    setIsLoading(false);
  }, [loadDocumentBatch]);

  const loadMoreDocuments = async () => {
    if (loadedAll || isLoading) return;

    const result = await loadDocumentBatch(documents.length);
    if (result.items.length > 0) {
      setDocuments(prev => [...prev, ...result.items]);
      setTotalSize(prev => prev + result.items.reduce((acc: number, curr: DocumentItem) => acc + curr.size, 0));
    }
    setLoadedAll(!result.hasMore);
  };

  useEffect(() => {
    loadInitialDocuments();
  }, [loadInitialDocuments]);

  const handleShare = async () => {
    try {
      if (selectedItems.length === 0) return;

      if (Platform.OS === 'android') {
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          const filesToShare = selectedItems.map(path => path);
          await Sharing.shareAsync(filesToShare[0], {
            dialogTitle: 'Share Document',
            mimeType: '*/*',
            UTI: 'public.data'
          });
        }
      } else {
        await Share.share({
          url: selectedItems[0],
          message: selectedItems.length > 1 ? `Sharing ${selectedItems.length} documents` : undefined
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

  const handleDocumentPress = async (item: DocumentItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.path);
      return;
    }

    try {
      if (Platform.OS === 'android') {
        const extension = item.type.toLowerCase();
        let mimeType = 'application/octet-stream';
        
        switch (extension) {
          case 'pdf':
            mimeType = 'application/pdf';
            break;
          case 'doc':
            mimeType = 'application/msword';
            break;
          case 'docx':
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
          case 'xls':
            mimeType = 'application/vnd.ms-excel';
            break;
          case 'xlsx':
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            break;
          case 'ppt':
            mimeType = 'application/vnd.ms-powerpoint';
            break;
          case 'pptx':
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            break;
          case 'txt':
            mimeType = 'text/plain';
            break;
        }

        // For text files, we need to ensure the file exists and is readable
        if (extension === 'txt') {
          const fileExists = await RNFS.exists(item.path);
          if (!fileExists) {
            console.error('Text file does not exist:', item.path);
            return;
          }
        }

        // Use content URI for better compatibility with document viewers
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: item.path,
          flags: 1,
          type: mimeType
        });
      }
    } catch (error) {
      console.error('Error opening document:', error);
    }
  };

  const handleDocumentLongPress = (path: string) => {
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
          {isSelectionMode ? `${selectedItems.length} selected` : 'Documents'}
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

  const renderDocumentItem = ({ item }: { item: DocumentItem }) => {
    const icon = getDocumentIcon(item.type);
    return (
      <TouchableOpacity 
        style={[
          styles.documentItem,
          selectedItems.includes(item.path) && styles.selectedDocumentItem
        ]}
        onPress={() => handleDocumentPress(item)}
        onLongPress={() => handleDocumentLongPress(item.path)}
      >
        <View style={[
          styles.iconContainer,
          selectedItems.includes(item.path) && styles.selectedIconContainer
        ]}>
          <MaterialIcons name={icon.name} size={32} color={icon.color} />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.documentType}>
            {item.type.toUpperCase()}
          </Text>
          <Text style={styles.documentDate}>
            {new Date(item.modifiedTime).toLocaleDateString()}
          </Text>
        </View>
        {selectedItems.includes(item.path) ? (
          <MaterialIcons name="check-circle" size={24} color="#B5E61D" />
        ) : (
          <Text style={styles.documentSize}>
            {formatFileSize(item.size)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

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

  const renderFooter = () => {
    if (!isLoading || loadedAll) return null;
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      {isLoading && documents.length === 0 ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDocumentItem}
          keyExtractor={item => item.path}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreDocuments}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
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
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333'
  },
  selectedDocumentItem: {
    backgroundColor: 'rgba(181, 230, 29, 0.1)'
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8
  },
  selectedIconContainer: {
    backgroundColor: 'rgba(181, 230, 29, 0.2)',
  },
  documentInfo: {
    flex: 1,
    marginRight: 16
  },
  documentName: {
    color: 'white',
    fontSize: 16,
    marginBottom: 4
  },
  documentType: {
    color: '#888888',
    fontSize: 12
  },
  documentDate: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2
  },
  documentSize: {
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
  },
  loaderContainer: {
    paddingVertical: 20,
    alignItems: 'center'
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

export default DocumentGallery; 