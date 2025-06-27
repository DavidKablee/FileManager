import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as RNFS from 'react-native-fs';

type RootStackParamList = {
  Home: undefined;
  FileExplorer: { initialPath: string; title: string };
  SearchScreen: undefined;
  InternalStorage: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FileItem = {
  name: string;
  path: string;
  isDirectory: boolean;
  modifiedTime: string;
  itemCount?: number;
  size?: number;
};

type PathStackItem = {
  path: string;
  title: string;
};

const InternalStorageScreen = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [sortAscending, setSortAscending] = useState(true);
  const [pathStack, setPathStack] = useState<PathStackItem[]>([{
    path: RNFS.ExternalStorageDirectoryPath,
    title: 'Internal storage'
  }]);
  const navigation = useNavigation<NavigationProp>();

  const loadFiles = async (path: string) => {
    try {
      const items = await RNFS.readDir(path);
      const fileItems: FileItem[] = [];

      for (const item of items) {
        let itemCount;
        let size = item.size;

        if (item.isDirectory()) {
          try {
            const subItems = await RNFS.readDir(item.path);
            itemCount = subItems.length;
          } catch (error) {
            console.warn(`Error reading directory ${item.path}:`, error);
            itemCount = 0;
          }
        }

        fileItems.push({
          name: item.name,
          path: item.path,
          isDirectory: item.isDirectory(),
          modifiedTime: new Date(item.mtime || Date.now()).toISOString(),
          itemCount,
          size,
        });
      }

      // Sort files
      sortFiles(fileItems);
      setFiles(fileItems);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  useEffect(() => {
    loadFiles(pathStack[pathStack.length - 1].path);
  }, [pathStack]);

  const sortFiles = (items: FileItem[]) => {
    items.sort((a, b) => {
      // Directories always come first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      if (sortBy === 'name') {
        return sortAscending ? 
          a.name.localeCompare(b.name) : 
          b.name.localeCompare(a.name);
      } else {
        const dateA = new Date(a.modifiedTime).getTime();
        const dateB = new Date(b.modifiedTime).getTime();
        return sortAscending ? dateA - dateB : dateB - dateA;
      }
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes}`;
  };

  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (item: FileItem) => {
    if (item.isDirectory) {
      if (item.name === 'Android') {
        return <MaterialIcons name="settings-applications" size={24} color="#64B5F6" />;
      }
      if (item.name === 'DCIM') {
        return <MaterialIcons name="video-library" size={24} color="#64B5F6" />;
      }
      if (item.name === 'Download') {
        return <MaterialIcons name="file-download" size={24} color="#64B5F6" />;
      }
      if (item.name === 'Music') {
        return <MaterialIcons name="music-note" size={24} color="#64B5F6" />;
      }
      if (item.name === 'Pictures') {
        return <MaterialIcons name="photo" size={24} color="#64B5F6" />;
      }
      if (item.name === 'Movies') {
        return <MaterialIcons name="movie" size={24} color="#64B5F6" />;
      }
      if (item.name === 'Documents') {
        return <MaterialIcons name="folder" size={24} color="#64B5F6" />;
      }
      return <MaterialIcons name="folder" size={24} color="#64B5F6" />;
    }
    return <MaterialIcons name="insert-drive-file" size={24} color="#78909C" />;
  };

  const handleBack = () => {
    if (pathStack.length > 1) {
      setPathStack(prev => prev.slice(0, -1));
    } else {
      navigation.goBack();
    }
  };

  const handleFolderPress = (item: FileItem) => {
    if (item.isDirectory) {
      setPathStack(prev => [...prev, { path: item.path, title: item.name }]);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{pathStack[pathStack.length - 1].title}</Text>
        <Text style={styles.subtitle}>{files.length} items</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => navigation.navigate('SearchScreen')}
        >
          <MaterialIcons name="search" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="more-vert" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSortHeader = () => (
    <View style={styles.sortHeader}>
      <TouchableOpacity 
        style={styles.sortButton}
        onPress={() => {
          setSortBy('name');
          const newFiles = [...files];
          sortFiles(newFiles);
          setFiles(newFiles);
        }}
      >
        <Text style={[styles.sortText, sortBy === 'name' && styles.sortTextActive]}>Name</Text>
        {sortBy === 'name' && (
          <MaterialIcons 
            name={sortAscending ? "arrow-upward" : "arrow-downward"} 
            size={16} 
            color="white" 
          />
        )}
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.sortButton}
        onPress={() => {
          setSortAscending(!sortAscending);
          const newFiles = [...files];
          sortFiles(newFiles);
          setFiles(newFiles);
        }}
      >
        <MaterialIcons 
          name={sortAscending ? "arrow-upward" : "arrow-downward"} 
          size={24} 
          color="white" 
        />
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: FileItem }) => (
    <TouchableOpacity 
      style={styles.fileItem}
      onPress={() => handleFolderPress(item)}
    >
      <View style={styles.fileIcon}>
        {getFileIcon(item)}
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName}>{item.name}</Text>
        <Text style={styles.fileDate}>{formatDate(item.modifiedTime)}</Text>
      </View>
      {item.isDirectory ? (
        <Text style={styles.itemCount}>{item.itemCount} items</Text>
      ) : (
        <Text style={styles.itemCount}>{formatFileSize(item.size)}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderSortHeader()}
      <FlatList
        data={files}
        renderItem={renderItem}
        keyExtractor={item => item.path}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000000',
  },
  backButton: {
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 16,
  },
  sortHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  sortText: {
    color: '#888',
    marginRight: 4,
  },
  sortTextActive: {
    color: 'white',
  },
  listContainer: {
    paddingTop: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  fileIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  fileName: {
    color: 'white',
    fontSize: 16,
    marginBottom: 4,
  },
  fileDate: {
    color: '#888',
    fontSize: 14,
  },
  itemCount: {
    color: '#888',
    fontSize: 14,
    marginLeft: 16,
  },
});

export default InternalStorageScreen; 