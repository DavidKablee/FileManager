import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Image, Platform, Modal, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FileItem } from '../utils/FileManagement';
import * as MediaLibrary from 'expo-media-library';
import ImageView from 'react-native-image-viewing';
import * as Sharing from 'expo-sharing';

type RootStackParamList = {
  Home: undefined;
  RecycleBin: undefined;
  ImageGallery: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const SPACING = 1;
const ITEM_WIDTH = (width - (COLUMN_COUNT + 1) * SPACING) / COLUMN_COUNT;

const ImageGallery = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const [isImageViewVisible, setIsImageViewVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const loadImages = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Media Library permission denied');
        return;
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo'],
        first: 10000,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      const imageFiles: FileItem[] = media.assets.map(asset => ({
        name: asset.filename,
        path: asset.uri.replace('file://', ''),
        size: asset.width * asset.height,
        modifiedTime: new Date(asset.creationTime * 1000).toISOString(),
        isDirectory: false,
        type: 'image'
      }));

      setFiles(imageFiles);
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

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

  const handleImagePress = (index: number) => {
    if (isSelectionMode) {
      toggleItemSelection(files[index].path);
    } else {
      setSelectedImageIndex(index);
      setIsImageViewVisible(true);
    }
  };

  const handleImageLongPress = (path: string) => {
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

  const handleShare = async () => {
    try {
      if (selectedItems.length === 0) return;

      if (Platform.OS === 'android') {
        // For Android, we can share multiple files
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          const filesToShare = selectedItems.map(path => `file://${path}`);
          await Sharing.shareAsync(filesToShare[0], {
            dialogTitle: 'Share Images',
            mimeType: 'image/*',
            UTI: 'public.image'
          });
        }
      } else {
        // For iOS, we'll use the Share API
        await Share.share({
          url: `file://${selectedItems[0]}`,
          message: selectedItems.length > 1 ? `Sharing ${selectedItems.length} images` : undefined
        });
      }
    } catch (error) {
      console.error('Error sharing files:', error);
    }
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
          {isSelectionMode ? `${selectedItems.length} selected` : 'Images'}
        </Text>
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

  const renderImage = ({ item, index }: { item: FileItem; index: number }) => (
    <TouchableOpacity
      onPress={() => handleImagePress(index)}
      onLongPress={() => handleImageLongPress(item.path)}
      style={styles.imageContainer}
    >
      <Image
        source={{ uri: `file://${item.path}` }}
        style={[
          styles.image,
          selectedItems.includes(item.path) && styles.selectedImage
        ]}
        resizeMode="cover"
      />
      {selectedItems.includes(item.path) && (
        <View style={styles.checkmarkContainer}>
          <MaterialIcons name="check-circle" size={24} color="#B5E61D" />
        </View>
      )}
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
        data={files}
        renderItem={renderImage}
        keyExtractor={item => item.path}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
      <ImageView
        images={files.map(file => ({ uri: `file://${file.path}` }))}
        imageIndex={selectedImageIndex}
        visible={isImageViewVisible}
        onRequestClose={() => setIsImageViewVisible(false)}
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
  headerRight: {
    flexDirection: 'row'
  },
  iconButton: {
    marginLeft: 16
  },
  gridContainer: {
    padding: SPACING
  },
  imageContainer: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    margin: SPACING / 2,
    position: 'relative'
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 4
  },
  selectedImage: {
    opacity: 0.7,
    borderWidth: 2,
    borderColor: '#B5E61D'
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12
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

export default ImageGallery;