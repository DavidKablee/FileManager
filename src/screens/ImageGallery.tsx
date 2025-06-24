import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Image, PermissionsAndroid, Platform, Modal } from 'react-native';
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
        RNFS.ExternalStorageDirectoryPath + '/Download'
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
        } catch (error) {
          console.warn(`Error reading directory ${dir}:`, error);
        }
      }

      // Sort files
      const sortedFiles = sortFiles(allFiles, sortBy, sortAscending);
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
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="folder" size={24} color="white" />
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
          <TouchableOpacity style={styles.imageContainer}>
            <Image
              source={{ uri: `file://${item.path}` }}
              style={styles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        keyExtractor={item => item.path}
        contentContainerStyle={styles.gridContainer}
      />
      {renderSortMenu()}
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
    padding: 0.5
  },
  imageContainer: {
    flex: 1/5,
    aspectRatio: 1,
    padding: 0.5
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e'
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
  }
});

export default ImageGallery; 