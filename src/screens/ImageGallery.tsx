import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Image, PermissionsAndroid, Platform, Modal, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { readDirectory } from '../utils/FileManagement';
import type { FileItem } from '../utils/FileManagement';
import * as RNFS from 'react-native-fs';

type SortOption = 'name' | 'date' | 'size';

const ImageGallery = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortAscending, setSortAscending] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const navigation = useNavigation();

  const loadImages = async () => {
    try {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Storage Permission",
            message: "App needs access to your storage to show images",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        if (permission !== 'granted') {
          console.error('Storage permission denied');
          return;
        }
      }

      // Get all files from common image directories
      const directories = [
        RNFS.ExternalStorageDirectoryPath + '/DCIM/Camera',
        RNFS.ExternalStorageDirectoryPath + '/DCIM',
        RNFS.ExternalStorageDirectoryPath + '/Pictures',
        RNFS.ExternalStorageDirectoryPath + '/Download',
        RNFS.ExternalStorageDirectoryPath + '/WhatsApp/Media/WhatsApp Images',
        RNFS.ExternalStorageDirectoryPath + '/Telegram/Telegram Images',
        RNFS.ExternalStorageDirectoryPath + '/Screenshots',
        RNFS.ExternalStorageDirectoryPath
      ];

      let allFiles: FileItem[] = [];
      
      for (const dir of directories) {
        try {
          const items = await RNFS.readDir(dir);
          const imageFiles = items.filter(item => {
            const ext = item.name.toLowerCase().split('.').pop();
            return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
          }).map(item => ({
            name: item.name,
            path: item.path,
            isDirectory: item.isDirectory(),
            size: item.size,
            modifiedTime: new Date(item.mtime || Date.now()).toISOString()
          }));
          allFiles = [...allFiles, ...imageFiles];

          // Also check subdirectories
          for (const item of items) {
            if (item.isDirectory()) {
              try {
                const subItems = await RNFS.readDir(item.path);
                const subImageFiles = subItems.filter(subItem => {
                  const ext = subItem.name.toLowerCase().split('.').pop();
                  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                }).map(subItem => ({
                  name: subItem.name,
                  path: subItem.path,
                  isDirectory: subItem.isDirectory(),
                  size: subItem.size,
                  modifiedTime: new Date(subItem.mtime || Date.now()).toISOString()
                }));
                allFiles = [...allFiles, ...subImageFiles];
              } catch (error) {
                console.warn(`Error reading subdirectory ${item.path}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`Error reading directory ${dir}:`, error);
        }
      }

      // Enhanced deduplication using multiple attributes
      const seenFiles = new Map<string, FileItem>();
      allFiles.forEach(file => {
        // Create a unique key using file name and size
        const fileName = file.name.toLowerCase();
        const key = `${fileName}-${file.size}`;
        
        if (!seenFiles.has(key)) {
          // If we haven't seen this file before, add it
          seenFiles.set(key, file);
        } else {
          // If we have seen it, keep the one with the most recent modification time
          const existingFile = seenFiles.get(key)!;
          const existingTime = new Date(existingFile.modifiedTime).getTime();
          const newTime = new Date(file.modifiedTime).getTime();
          
          if (newTime > existingTime) {
            seenFiles.set(key, file);
          }
        }
      });

      // Convert Map back to array and sort
      const uniqueFiles = Array.from(seenFiles.values());
      const sortedFiles = sortFiles(uniqueFiles, sortBy, sortAscending);
      setFiles(sortedFiles);
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const sortFiles = (filesToSort: FileItem[], option: SortOption, ascending: boolean) => {
    return [...filesToSort].sort((a, b) => {
      let comparison = 0;
      if (option === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (option === 'date') {
        comparison = new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime();
      } else {
        comparison = a.size - b.size;
      }
      return ascending ? comparison : -comparison;
    });
  };

  const handleSort = (option: SortOption) => {
    setSortBy(option);
    setShowSortMenu(false);
    const sorted = sortFiles(files, option, sortAscending);
    setFiles(sorted);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const currentPath = RNFS.ExternalStorageDirectoryPath + '/DCIM';
      const newFolderPath = `${currentPath}/${newFolderName}`;
      
      await RNFS.mkdir(newFolderPath);
      setShowNewFolderModal(false);
      setNewFolderName('');
      loadImages(); // Refresh the list
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const renderSortMenu = () => (
    <Modal
      visible={showSortMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSortMenu(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1} 
        onPress={() => setShowSortMenu(false)}
      >
        <View style={styles.sortMenu}>
          <TouchableOpacity 
            style={styles.sortOption} 
            onPress={() => handleSort('name')}
          >
            <MaterialIcons name="sort-by-alpha" size={24} color="white" />
            <Text style={styles.sortOptionText}>Name</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sortOption} 
            onPress={() => handleSort('date')}
          >
            <MaterialIcons name="access-time" size={24} color="white" />
            <Text style={styles.sortOptionText}>Date</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sortOption} 
            onPress={() => handleSort('size')}
          >
            <MaterialIcons name="sort" size={24} color="white" />
            <Text style={styles.sortOptionText}>Size</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sortOption} 
            onPress={() => {
              setSortAscending(!sortAscending);
              const sorted = sortFiles(files, sortBy, !sortAscending);
              setFiles(sorted);
            }}
          >
            <MaterialIcons 
              name={sortAscending ? "arrow-upward" : "arrow-downward"} 
              size={24} 
              color="white" 
            />
            <Text style={styles.sortOptionText}>
              {sortAscending ? "Ascending" : "Descending"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderNewFolderModal = () => (
    <Modal
      visible={showNewFolderModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowNewFolderModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1} 
        onPress={() => setShowNewFolderModal(false)}
      >
        <View style={styles.newFolderModal}>
          <Text style={styles.modalTitle}>Create New Folder</Text>
          <TextInput
            style={styles.folderNameInput}
            placeholder="Folder name"
            placeholderTextColor="#666"
            value={newFolderName}
            onChangeText={setNewFolderName}
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowNewFolderModal(false);
                setNewFolderName('');
              }}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.createButton]}
              onPress={handleCreateFolder}
            >
              <Text style={styles.buttonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Images</Text>
        <Text style={styles.subtitle}>{files.length} items</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => setShowNewFolderModal(true)}
        >
          <MaterialIcons name="create-new-folder" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="search" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => setShowSortMenu(true)}
        >
          <MaterialIcons name="more-vert" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={files}
        numColumns={5}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={() => {
              // Handle image tap
              console.log('Opening image:', item.path);
            }}
          >
            <Image
              source={{ uri: `file://${item.path}` }}
              style={styles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        keyExtractor={item => item.path}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
      {renderSortMenu()}
      {renderNewFolderModal()}
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
  gridContainer: {
    padding: 0.5,
  },
  imageContainer: {
    flex: 1/5,
    aspectRatio: 1,
    padding: 0.5,
  },
  image: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#2c2c2c',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  sortMenu: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  sortOptionText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 16
  },
  newFolderModal: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    alignSelf: 'center',
    marginTop: '50%',
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  folderNameInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ImageGallery; 