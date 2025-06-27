import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, Modal, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { formatFileSize } from '../utils/FileManagement';
import * as IntentLauncher from 'expo-intent-launcher';

type RootStackParamList = {
  Home: undefined;
  RecycleBin: undefined;
  AudioGallery: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type AudioItem = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  duration: number;
  artist?: string;
  album?: string;
};

const getAudioIcon = (filename: string): { name: string; color: string } => {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'mp3':
      return { name: 'music-note', color: '#2196F3' };
    case 'wav':
      return { name: 'waves', color: '#4CAF50' };
    case 'm4a':
      return { name: 'audiotrack', color: '#FF9800' };
    case 'ogg':
      return { name: 'music-video', color: '#9C27B0' };
    default:
      return { name: 'audio-file', color: '#757575' };
  }
};

const AudioGallery = () => {
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const loadAudioFiles = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Media Library permission denied');
        return;
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: ['audio'],
        first: 10000,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      const audioFiles = await Promise.all(
        media.assets.map(async (asset) => {
          const info = await MediaLibrary.getAssetInfoAsync(asset);
          return {
            name: asset.filename,
            path: asset.uri.replace('file://', ''),
            size: asset.duration * 100000,
            modifiedTime: new Date(asset.creationTime * 1000).toISOString(),
            duration: asset.duration,
            artist: info.exif?.Artist || 'Unknown Artist',
            album: info.exif?.Album || 'Unknown Album'
          };
        })
      );

      const totalAudioSize = audioFiles.reduce((acc, curr) => acc + curr.size, 0);
      setTotalSize(totalAudioSize);
      setAudioFiles(audioFiles);
    } catch (error) {
      console.error('Error loading audio files:', error);
    }
  };

  useEffect(() => {
    loadAudioFiles();
  }, []);

  const handleShare = async () => {
    try {
      if (selectedItems.length === 0) return;

      if (Platform.OS === 'android') {
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          const filesToShare = selectedItems.map(path => `file://${path}`);
          await Sharing.shareAsync(filesToShare[0], {
            dialogTitle: 'Share Audio',
            mimeType: 'audio/*',
            UTI: 'public.audio'
          });
        }
      } else {
        await Share.share({
          url: `file://${selectedItems[0]}`,
          message: selectedItems.length > 1 ? `Sharing ${selectedItems.length} audio files` : undefined
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

  const handleAudioPress = async (item: AudioItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.path);
      return;
    }

    try {
      if (Platform.OS === 'android') {
        const extension = item.name.toLowerCase().split('.').pop();
        let mimeType = 'audio/*';
        
        switch (extension) {
          case 'mp3':
            mimeType = 'audio/mpeg';
            break;
          case 'wav':
            mimeType = 'audio/wav';
            break;
          case 'm4a':
            mimeType = 'audio/mp4';
            break;
          case 'ogg':
            mimeType = 'audio/ogg';
            break;
        }

        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: item.path,
          flags: 1,
          type: mimeType
        });
      }
    } catch (error) {
      console.error('Error opening audio file:', error);
    }
  };

  const handleAudioLongPress = (path: string) => {
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
          {isSelectionMode ? `${selectedItems.length} selected` : 'Audio files'}
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

  const renderAudioItem = ({ item }: { item: AudioItem }) => {
    const icon = getAudioIcon(item.name);
    return (
      <TouchableOpacity 
        style={[
          styles.audioItem,
          selectedItems.includes(item.path) && styles.selectedAudioItem
        ]}
        onPress={() => handleAudioPress(item)}
        onLongPress={() => handleAudioLongPress(item.path)}
      >
        <View style={[
          styles.iconContainer,
          selectedItems.includes(item.path) && styles.selectedIconContainer
        ]}>
          <MaterialIcons name={icon.name} size={32} color={icon.color} />
        </View>
        <View style={styles.audioInfo}>
          <Text style={styles.audioName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {item.artist || 'Unknown Artist'}
          </Text>
          <Text style={styles.audioDate}>
            {new Date(item.modifiedTime).toLocaleDateString()}
          </Text>
        </View>
        {selectedItems.includes(item.path) ? (
          <MaterialIcons name="check-circle" size={24} color="#B5E61D" />
        ) : (
          <Text style={styles.audioSize}>
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
  audioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333'
  },
  selectedAudioItem: {
    backgroundColor: 'rgba(181, 230, 29, 0.1)'
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 24
  },
  selectedIconContainer: {
    backgroundColor: 'rgba(181, 230, 29, 0.2)',
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
  artistName: {
    color: '#888888',
    fontSize: 14,
    marginBottom: 2
  },
  audioDate: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2
  },
  audioSize: {
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
  }
});

export default AudioGallery; 