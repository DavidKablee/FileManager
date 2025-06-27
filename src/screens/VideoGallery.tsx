import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Image, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as RNFS from 'react-native-fs';
import { formatFileSize } from '../utils/FileManagement';

type VideoItem = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
};

const VideoGallery = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const navigation = useNavigation();

  const findVideosInDirectory = async (directory: string): Promise<VideoItem[]> => {
    try {
      const items = await RNFS.readDir(directory);
      let videos: VideoItem[] = [];

      for (const item of items) {
        if (item.isDirectory()) {
          // Recursively search in subdirectories
          const subDirVideos = await findVideosInDirectory(item.path);
          videos = [...videos, ...subDirVideos];
        } else {
          const ext = item.name.toLowerCase().split('.').pop();
          if (['mp4', 'mov', '3gp', 'mkv', 'avi', 'webm'].includes(ext || '')) {
            videos.push({
              name: item.name,
              path: item.path,
              size: item.size,
              modifiedTime: new Date(item.mtime || Date.now()).toISOString()
            });
          }
        }
      }

      return videos;
    } catch (error) {
      console.warn(`Error reading directory ${directory}:`, error);
      return [];
    }
  };

  const loadVideos = async () => {
    try {
      // Start search from the root storage directory
      const rootDir = RNFS.ExternalStorageDirectoryPath;
      const allVideos = await findVideosInDirectory(rootDir);

      // Calculate total size
      const totalVideoSize = allVideos.reduce((acc, curr) => acc + curr.size, 0);

      // Sort videos by date (newest first)
      const sortedVideos = allVideos.sort((a, b) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      setTotalSize(totalVideoSize);
      setVideos(sortedVideos);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Videos</Text>
        <Text style={styles.subtitle}>{formatFileSize(totalSize)}</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="folder" size={24} color="white" />
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

  const renderVideoItem = ({ item }: { item: VideoItem }) => (
    <TouchableOpacity style={styles.videoContainer}>
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: `file://${item.path}` }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.playButton}>
          <MaterialIcons name="play-arrow" size={20} color="white" />
        </View>
      </View>
      <Text style={styles.videoName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={item => item.path}
        numColumns={5}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const { width } = Dimensions.get('window');
const columnWidth = width / 5; // Changed to 5 columns

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
    padding: 1
  },
  videoContainer: {
    width: columnWidth,
    padding: 1
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 1, // Changed to square aspect ratio for better grid appearance
    backgroundColor: '#1e1e1e',
    position: 'relative'
  },
  thumbnail: {
    width: '100%',
    height: '100%'
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 6
  },
  videoName: {
    color: 'white',
    fontSize: 11, // Reduced font size for better fit in 5-column layout
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 2
  }
});

export default VideoGallery; 