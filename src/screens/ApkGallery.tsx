import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as RNFS from 'react-native-fs';

type ApkFile = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  icon?: string;
};

const ApkGallery = () => {
  const [apkFiles, setApkFiles] = useState<ApkFile[]>([]);
  const [sortByDate, setSortByDate] = useState(true);
  const navigation = useNavigation();

  const loadApks = async () => {
    try {
      // Get all APKs from common directories
      const directories = [
        RNFS.ExternalStorageDirectoryPath + '/Download',
        RNFS.ExternalStorageDirectoryPath + '/Downloads',
        RNFS.ExternalStorageDirectoryPath,
        RNFS.ExternalStorageDirectoryPath + '/Documents',
        RNFS.DownloadDirectoryPath
      ];

      let allApks: ApkFile[] = [];

      for (const dir of directories) {
        try {
          const items = await RNFS.readDir(dir);
          const apkFiles = items.filter(item => {
            const ext = item.name.toLowerCase().split('.').pop();
            return ext === 'apk';
          }).map(item => ({
            name: item.name,
            path: item.path,
            size: item.size,
            modifiedTime: new Date(item.mtime || Date.now()).toISOString(),
          }));
          allApks = [...allApks, ...apkFiles];

          // Also check subdirectories
          for (const item of items) {
            if (item.isDirectory()) {
              try {
                const subItems = await RNFS.readDir(item.path);
                const subApkFiles = subItems.filter(subItem => {
                  const ext = subItem.name.toLowerCase().split('.').pop();
                  return ext === 'apk';
                }).map(subItem => ({
                  name: subItem.name,
                  path: subItem.path,
                  size: subItem.size,
                  modifiedTime: new Date(subItem.mtime || Date.now()).toISOString(),
                }));
                allApks = [...allApks, ...subApkFiles];
              } catch (error) {
                console.warn(`Error reading subdirectory ${item.path}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`Error reading directory ${dir}:`, error);
        }
      }

      // Remove duplicates based on file path
      const uniqueApks = Array.from(new Map(allApks.map(apk => [apk.path, apk])).values());

      // Sort by date (newest first)
      uniqueApks.sort((a, b) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      setApkFiles(uniqueApks);
    } catch (error) {
      console.error('Error loading APKs:', error);
    }
  };

  useEffect(() => {
    loadApks();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${hours}:${minutes}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Installation files</Text>
        <Text style={styles.subtitle}>{formatFileSize(apkFiles.reduce((total, file) => total + file.size, 0))}</Text>
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

  const renderItem = ({ item }: { item: ApkFile }) => (
    <TouchableOpacity style={styles.apkItem}>
      <View style={styles.apkIcon}>
        <MaterialIcons name="android" size={40} color="#4CAF50" />
      </View>
      <View style={styles.apkInfo}>
        <Text style={styles.apkName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.apkDate}>
          {formatDate(item.modifiedTime)}
        </Text>
      </View>
      <Text style={styles.apkSize}>
        {formatFileSize(item.size)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={apkFiles}
        renderItem={renderItem}
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
  listContainer: {
    paddingHorizontal: 16,
  },
  apkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  apkIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  apkInfo: {
    flex: 1,
    marginLeft: 16,
  },
  apkName: {
    fontSize: 16,
    color: 'white',
    marginBottom: 4,
  },
  apkDate: {
    fontSize: 14,
    color: '#888',
  },
  apkSize: {
    fontSize: 14,
    color: '#888',
    marginLeft: 16,
  },
});

export default ApkGallery; 