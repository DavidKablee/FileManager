import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as RNFS from 'react-native-fs';
import { formatFileSize } from '../utils/FileManagement';

type AudioItem = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  type: string;
};

const AudioGallery = () => {
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const navigation = useNavigation();

  const findAudioFiles = async (directory: string): Promise<AudioItem[]> => {
    try {
      const items = await RNFS.readDir(directory);
      let audios: AudioItem[] = [];

      for (const item of items) {
        if (item.isDirectory()) {
          // Recursively search in subdirectories
          const subDirAudios = await findAudioFiles(item.path);
          audios = [...audios, ...subDirAudios];
        } else {
          const ext = item.name.toLowerCase().split('.').pop();
          if (['mp3', 'wav', 'm4a', 'opus', 'aac', 'ogg'].includes(ext || '')) {
            audios.push({
              name: item.name,
              path: item.path,
              size: item.size,
              modifiedTime: new Date(item.mtime || Date.now()).toISOString(),
              type: ext || ''
            });
          }
        }
      }

      return audios;
    } catch (error) {
      console.warn(`Error reading directory ${directory}:`, error);
      return [];
    }
  };

  const loadAudioFiles = async () => {
    try {
      // Start search from the root storage directory
      const rootDir = RNFS.ExternalStorageDirectoryPath;
      const allAudios = await findAudioFiles(rootDir);

      // Calculate total size
      const totalAudioSize = allAudios.reduce((acc, curr) => acc + curr.size, 0);

      // Sort audio files by date (newest first)
      const sortedAudios = allAudios.sort((a, b) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      setTotalSize(totalAudioSize);
      setAudioFiles(sortedAudios);
    } catch (error) {
      console.error('Error loading audio files:', error);
    }
  };

  useEffect(() => {
    loadAudioFiles();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Audio files</Text>
        <Text style={styles.subtitle}>{formatFileSize(totalSize)}</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="sort" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="search" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="more-vert" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'opus':
        return 'description';
      case 'm4a':
        return 'mic';
      default:
        return 'audiotrack';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const renderAudioItem = ({ item }: { item: AudioItem }) => (
    <TouchableOpacity style={styles.audioItem}>
      <View style={styles.iconContainer}>
        <MaterialIcons 
          name={getFileIcon(item.type)} 
          size={24} 
          color={item.type === 'm4a' ? '#E53935' : '#2196F3'} 
        />
      </View>
      <View style={styles.audioInfo}>
        <Text style={styles.audioName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.audioDate}>
          {formatDate(item.modifiedTime)}
        </Text>
      </View>
      <Text style={styles.audioSize}>
        {formatFileSize(item.size)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={audioFiles}
        renderItem={renderAudioItem}
        keyExtractor={item => item.path}
        contentContainerStyle={styles.listContainer}
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
  audioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333'
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  audioInfo: {
    flex: 1,
    marginRight: 16
  },
  audioName: {
    color: 'white',
    fontSize: 16,
    marginBottom: 4
  },
  audioDate: {
    color: '#888888',
    fontSize: 12
  },
  audioSize: {
    color: '#888888',
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right'
  }
});

export default AudioGallery; 