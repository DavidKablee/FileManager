import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, Dimensions, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeContext } from '../utils/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
}

const { width } = Dimensions.get('window');

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

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [120, 80],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  const toggleTheme = () => {
    setThemeType(themeType === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      console.log('Loading files from path:', path);
      const items = await FileSystem.readDirectoryAsync(path);
      console.log('Files loaded:', items.length);
      
      const fileItems = await Promise.all(
        items.map(async (name) => {
          const fullPath = `${path}${name}`;
          const info = await FileSystem.getInfoAsync(fullPath);
          return {
            name,
            path: fullPath,
            isFile: info.exists && !info.isDirectory,
          };
        })
      );
      
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
    }
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setCurrentPath(prev);
    }
  };

  const getFileIcon = (isFile: boolean) => {
    return isFile ? 'insert-drive-file' : 'folder';
  };

  const handleNewFolder = () => {
    // TODO: Implement new folder creation
    console.log('Create new folder');
  };

  const handleUpload = () => {
    // TODO: Implement file upload
    console.log('Upload file');
  };

  const handleSearch = () => {
    // TODO: Implement search functionality
    console.log('Search files');
  };

  const renderHeader = () => (
    <View style={[
      styles.header,
      {
        backgroundColor: theme.headerBackground,
        paddingTop: insets.top,
        borderBottomColor: theme.border,
      }
    ]}>
      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {route.params?.title || currentPath.split('/').pop() || 'Root'}
        </Text>
        <TouchableOpacity
          onPress={toggleTheme}
          style={styles.themeButton}
        >
          <MaterialIcons
            name={themeType === 'dark' ? 'light-mode' : 'dark-mode'}
            size={24}
            color={theme.text}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.headerBottom}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.homeButton}
        >
          <MaterialIcons name="home" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleNewFolder}
          style={styles.actionButton}
        >
          <MaterialIcons name="create-new-folder" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleUpload}
          style={styles.actionButton}
        >
          <MaterialIcons name="upload-file" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSearch}
          style={styles.actionButton}
        >
          <MaterialIcons name="search" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: FileItem }) => (
    <TouchableOpacity 
      onPress={() => openFolder(item)} 
      style={[
        styles.item,
        { 
          backgroundColor: theme.itemBackground,
          borderBottomColor: theme.itemBorder,
          elevation: theme.elevation / 2,
          shadowColor: theme.shadowColor,
          shadowOpacity: theme.shadowOpacity / 2,
          shadowRadius: theme.shadowRadius / 2,
          shadowOffset: theme.shadowOffset,
        }
      ]}
    >
      <MaterialIcons 
        name={getFileIcon(item.isFile)} 
        size={24} 
        color={theme.icon} 
        style={styles.icon}
      />
      <View style={styles.itemContent}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.itemType, { color: theme.secondaryText }]}>
          {item.isFile ? 'File' : 'Folder'}
        </Text>
      </View>
      {!item.isFile && (
        <MaterialIcons name="chevron-right" size={24} color={theme.secondaryText} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderHeader()}
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <Animated.FlatList
          data={files}
          keyExtractor={item => item.path}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="folder-open" size={48} color={theme.emptyText} />
              <Text style={[styles.emptyText, { color: theme.emptyText }]}>
                No files found
              </Text>
            </View>
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
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
  },
  header: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  homeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  themeButton: {
    padding: 8,
    marginLeft: 10,
  },
  headerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  actionButton: {
    padding: 8,
  },
  path: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 5,
    width: '100%',
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  icon: {
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemType: {
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
    fontSize: 16,
    marginTop: 12,
  },
  loader: {
    marginTop: 20,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
});

export default FileExplorer; 