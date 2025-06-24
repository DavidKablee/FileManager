import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Image, PermissionsAndroid, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { readDirectory } from '../utils/FileManagement';
import type { FileItem } from '../utils/FileManagement';
import * as MediaLibrary from 'expo-media-library';

const ImageGallery = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    const loadImages = async () => {
      try {
        // Request permissions first
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

        // Get media library permission
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          console.error('Media library permission denied');
          return;
        }

        // Get all photos
        const media = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          first: 50 // Load first 50 images for better performance
        });

        // Convert to FileItem format
        const fileItems: FileItem[] = media.assets.map(asset => ({
          name: asset.filename,
          path: asset.uri,
          isDirectory: false,
          size: asset.fileSize || 0,
          modifiedTime: new Date(asset.creationTime).toISOString()
        }));

        setFiles(fileItems);
      } catch (error) {
        console.error('Error loading images:', error);
      }
    };

    loadImages();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Images</Text>
        <Text style={styles.subtitle}>97.81 MB</Text>
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

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={files}
        numColumns={5}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.imageContainer}>
            <Image
              source={{ uri: item.path }}
              style={styles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        keyExtractor={item => item.path}
        contentContainerStyle={styles.gridContainer}
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
  }
});

export default ImageGallery; 