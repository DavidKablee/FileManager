import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Image, Platform, Modal, Share, NativeModules, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system';
import { formatFileSize } from '../utils/FileManagement';

type RootStackParamList = {
  Home: undefined;
  RecycleBin: undefined;
  VideoGallery: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type VideoItem = {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  duration: number;
  thumbnail?: string;
};

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const SPACING = 1;
const ITEM_WIDTH = (width - (COLUMN_COUNT + 1) * SPACING) / COLUMN_COUNT;

const VideoGallery = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const loadVideos = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Media Library permission denied');
        return;
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: ['video'],
        first: 10000,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      const videoFiles = media.assets.map(asset => ({
        id: asset.id,
        name: asset.filename,
        path: asset.uri,
        size: asset.duration * 1000000,
        modifiedTime: new Date(asset.creationTime * 1000).toISOString(),
        duration: asset.duration,
        thumbnail: asset.uri
      }));

      const totalVideoSize = videoFiles.reduce((acc, curr) => acc + curr.size, 0);
      setTotalSize(totalVideoSize);
      setVideos(videoFiles);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const handleShare = async () => {
    try {
      if (selectedItems.length === 0) return;

      if (Platform.OS === 'android') {
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          const filesToShare = selectedItems.map(path => `file://${path}`);
          await Sharing.shareAsync(filesToShare[0], {
            dialogTitle: 'Share Videos',
            mimeType: 'video/*',
            UTI: 'public.video'
          });
        }
      } else {
        await Share.share({
          url: `file://${selectedItems[0]}`,
          message: selectedItems.length > 1 ? `Sharing ${selectedItems.length} videos` : undefined
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

  const getContentUri = async (filePath: string): Promise<string> => {
    if (Platform.OS !== 'android') return filePath;

    try {
      // First, copy the file to app's cache directory
      const filename = filePath.split('/').pop();
      if (!filename) throw new Error('Invalid file path');

      const cacheFilePath = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.copyAsync({
        from: filePath,
        to: cacheFilePath
      });

      // Get content URI using FileProvider
      const contentUri = `content://${NativeModules.BuildConfig.APPLICATION_ID}.provider/root/${filename}`;
      return contentUri;
    } catch (error) {
      console.error('Error getting content URI:', error);
      throw error;
    }
  };

  const playVideo = async (video: VideoItem) => {
    try {
      if (Platform.OS === 'android') {
        // Construct the content URI using the MediaLibrary asset ID
        const contentUri = `content://media/external/video/media/${video.id}`;

        // Open video using Intent
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: 'video/*'
        });
      } else {
        // For iOS, use Share API to open video
        await Share.share({
          url: video.path
        });
      }
    } catch (error) {
      console.error('Error playing video:', error);
      // If the direct content URI fails, try using the asset URI
      if (Platform.OS === 'android') {
        try {
          const asset = await MediaLibrary.getAssetInfoAsync(video.id);
          if (asset) {
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: asset.uri,
              flags: 1,
              type: 'video/*'
            });
          }
        } catch (fallbackError) {
          console.error('Error with fallback video opening:', fallbackError);
        }
      }
    }
  };

  const handleVideoPress = (item: VideoItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.path);
    } else {
      playVideo(item);
    }
  };

  const handleVideoLongPress = (path: string) => {
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

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
          {isSelectionMode ? `${selectedItems.length} selected` : 'Videos'}
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

  const renderVideoItem = ({ item }: { item: VideoItem }) => (
    <TouchableOpacity 
      style={styles.videoContainer}
      onPress={() => handleVideoPress(item)}
      onLongPress={() => handleVideoLongPress(item.path)}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: item.thumbnail }}
          style={[
            styles.thumbnail,
            selectedItems.includes(item.path) && styles.selectedThumbnail
          ]}
          resizeMode="cover"
        />
        <View style={styles.playButton}>
          <MaterialIcons name="play-arrow" size={20} color="white" />
        </View>
        <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
        {selectedItems.includes(item.path) && (
          <View style={styles.checkmarkContainer}>
            <MaterialIcons name="check-circle" size={24} color="#B5E61D" />
          </View>
        )}
      </View>
      <Text style={styles.videoName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

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

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={item => item.path}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
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
  gridContainer: {
    padding: SPACING
  },
  videoContainer: {
    width: ITEM_WIDTH,
    marginBottom: SPACING * 2
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#1e1e1e',
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden'
  },
  thumbnail: {
    width: '100%',
    height: '100%'
  },
  selectedThumbnail: {
    opacity: 0.7,
    borderWidth: 2,
    borderColor: '#B5E61D'
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
  duration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    fontSize: 10,
    padding: 2,
    paddingHorizontal: 4,
    borderRadius: 2
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12
  },
  videoName: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 2
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
  }
});

export default VideoGallery; 