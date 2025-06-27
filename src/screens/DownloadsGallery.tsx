import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as RNFS from 'react-native-fs';
import { formatFileSize } from '../utils/FileManagement';

type RootStackParamList = {
  Home: undefined;
  FileExplorer: { initialPath: string; title: string };
  DownloadsGallery: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type DownloadItem = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  type: string;
  source?: string;
  isDirectory: boolean;
  itemCount?: number;
};

type Section = {
  title: string;
  data: DownloadItem[];
};

const DownloadsGallery = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [pathStack, setPathStack] = useState<{ path: string; title: string }[]>([]);
  const navigation = useNavigation();

  const getFileIcon = (item: DownloadItem) => {
    if (item.isDirectory) {
      return <MaterialIcons name="folder" size={40} color="#64B5F6" />;
    }
    
    const ext = item.type.toLowerCase();
    if (ext === 'apk') {
      return <MaterialIcons name="android" size={40} color="#4CAF50" />;
    } else if (ext === 'pdf') {
      return <MaterialIcons name="picture-as-pdf" size={40} color="#F44336" />;
    } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      return <MaterialIcons name="image" size={40} color="#FF9800" />;
    }
    return <MaterialIcons name="insert-drive-file" size={40} color="#78909C" />;
  };

  const findDownloads = async (directory: string): Promise<DownloadItem[]> => {
    try {
      const items = await RNFS.readDir(directory);
      let downloads: DownloadItem[] = [];

      for (const item of items) {
        if (item.isDirectory()) {
          const subItems = await RNFS.readDir(item.path);
          downloads.push({
            name: item.name,
            path: item.path,
            size: 0,
            modifiedTime: new Date(item.mtime || Date.now()).toISOString(),
            type: 'directory',
            isDirectory: true,
            itemCount: subItems.length
          });
          
          // Only get files from subdirectories if we're in the root downloads view
          if (!currentPath) {
            const subDirFiles = await findDownloads(item.path);
            downloads = [...downloads, ...subDirFiles.filter(file => !file.isDirectory)];
          }
        } else {
          const ext = item.name.split('.').pop() || '';
          // Try to get the source from the file path
          const pathParts = item.path.split('/');
          const possibleSource = pathParts[pathParts.length - 2];
          const source = possibleSource === 'Download' ? undefined : possibleSource;
          
          downloads.push({
            name: item.name,
            path: item.path,
            size: item.size,
            modifiedTime: new Date(item.mtime || Date.now()).toISOString(),
            type: ext,
            source: source,
            isDirectory: false
          });
        }
      }

      return downloads;
    } catch (error) {
      console.warn(`Error reading directory ${directory}:`, error);
      return [];
    }
  };

  const organizeSections = (downloads: DownloadItem[]) => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const thisWeek: DownloadItem[] = [];
    const thisMonth: DownloadItem[] = [];
    const older: DownloadItem[] = [];

    downloads.forEach(item => {
      const itemDate = new Date(item.modifiedTime);
      if (itemDate >= oneWeekAgo) {
        thisWeek.push(item);
      } else if (itemDate >= oneMonthAgo) {
        thisMonth.push(item);
      } else {
        older.push(item);
      }
    });

    const sections: Section[] = [];
    if (thisWeek.length > 0) {
      sections.push({ title: 'This week', data: thisWeek });
    }
    if (thisMonth.length > 0) {
      sections.push({ title: 'This month', data: thisMonth });
    }
    if (older.length > 0) {
      sections.push({ title: 'Older', data: older });
    }

    return sections;
  };

  const loadDownloads = async () => {
    try {
      if (currentPath) {
        // If we're in a specific folder, just load its contents
        const downloads = await findDownloads(currentPath);
        downloads.sort((a, b) => 
          new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
        );
        const organized = organizeSections(downloads);
        setSections(organized);
      } else {
        // Get downloads from common download directories
        const directories = [
          RNFS.ExternalStorageDirectoryPath + '/Download',
          RNFS.ExternalStorageDirectoryPath + '/Downloads',
          RNFS.DownloadDirectoryPath
        ];

        // Use a Map to deduplicate files based on their name and size
        const uniqueDownloads = new Map<string, DownloadItem>();

        for (const dir of directories) {
          try {
            const downloads = await findDownloads(dir);
            downloads.forEach(item => {
              const key = `${item.name}-${item.size}`; // Use name and size as unique identifier
              // Only keep the first occurrence or update if it's a more recent version
              if (!uniqueDownloads.has(key) || 
                  new Date(item.modifiedTime).getTime() > new Date(uniqueDownloads.get(key)!.modifiedTime).getTime()) {
                uniqueDownloads.set(key, item);
              }
            });
          } catch (error) {
            console.warn(`Error reading directory ${dir}:`, error);
          }
        }

        // Convert Map back to array and sort
        const allDownloads = Array.from(uniqueDownloads.values());
        allDownloads.sort((a, b) => 
          new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
        );

        const organized = organizeSections(allDownloads);
        setSections(organized);
      }
    } catch (error) {
      console.error('Error loading downloads:', error);
    }
  };

  useEffect(() => {
    loadDownloads();
  }, [currentPath]);

  const handleBack = () => {
    if (currentPath) {
      // If we're in a folder, go back to previous folder or root
      const newStack = [...pathStack];
      newStack.pop();
      setPathStack(newStack);
      
      if (newStack.length === 0) {
        setCurrentPath(null);
      } else {
        const previous = newStack[newStack.length - 1];
        setCurrentPath(previous.path);
      }
    } else {
      navigation.goBack();
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>
          {currentPath 
            ? pathStack[pathStack.length - 1]?.title || 'Downloads'
            : 'Downloads'
          }
        </Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="search" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="more-vert" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item }: { item: DownloadItem }) => (
    <TouchableOpacity 
      style={styles.downloadItem}
      onPress={() => {
        if (item.isDirectory) {
          // Navigate to the folder internally
          setPathStack([...pathStack, { path: item.path, title: item.name }]);
          setCurrentPath(item.path);
        } else {
          // Handle file opening here if needed
          console.log('Opening file:', item.path);
        }
      }}
    >
      <View style={styles.iconContainer}>
        {getFileIcon(item)}
      </View>
      <View style={styles.downloadInfo}>
        <Text style={styles.downloadName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.source && (
          <Text style={styles.downloadSource}>
            From: {item.source}
          </Text>
        )}
        <Text style={styles.downloadDate}>
          {formatDate(item.modifiedTime)}
        </Text>
      </View>
      <Text style={styles.downloadSize}>
        {item.isDirectory ? `${item.itemCount} items` : formatFileSize(item.size)}
      </Text>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item, index) => `${item.path}-${index}`}
        contentContainerStyle={styles.listContainer}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
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
  headerRight: {
    flexDirection: 'row'
  },
  iconButton: {
    marginLeft: 16
  },
  listContainer: {
    paddingHorizontal: 16
  },
  sectionHeader: {
    paddingVertical: 8,
    backgroundColor: '#000000'
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500'
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333'
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 4
  },
  downloadInfo: {
    flex: 1,
    marginRight: 16
  },
  downloadName: {
    color: 'white',
    fontSize: 16,
    marginBottom: 4
  },
  downloadSource: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 2
  },
  downloadDate: {
    color: '#888888',
    fontSize: 12
  },
  downloadSize: {
    color: '#888888',
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right'
  }
});

export default DownloadsGallery; 