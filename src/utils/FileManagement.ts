import * as FileSystem from 'expo-file-system';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: string;
  itemCount?: number;
  permissions?: string;
  owner?: string;
  group?: string;
}

// Get the base storage path based on platform
export const getBaseStoragePath = () => {
  return Platform.OS === 'android' 
    ? '/storage/emulated/0'  // Android internal storage path
    : FileSystem.documentDirectory; // iOS uses app's document directory
};

// Enhanced function to get file info with detailed stats
export const getFileInfo = async (path: string): Promise<FileItem> => {
  try {
    if (Platform.OS === 'android') {
      // Use RNFS for better Android file access
      const stats = await RNFS.stat(path);
      const isDirectory = stats.isDirectory();
      
      let itemCount = 0;
      if (isDirectory) {
        try {
          const files = await RNFS.readDir(path);
          itemCount = files.length;
        } catch (error) {
          console.warn(`Could not read directory ${path}:`, error);
        }
      }

      return {
        name: path.split('/').pop() || '',
        path: path,
        isDirectory,
        size: stats.size,
        modifiedTime: new Date(stats.mtime).toISOString(),
        itemCount: isDirectory ? itemCount : undefined,
        permissions: stats.mode.toString()
      };
    } else {
      // Use Expo FileSystem for iOS
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const stats = await FileSystem.getInfoAsync(path, { size: true });
      const isDirectory = fileInfo.isDirectory;
      let itemCount = 0;

      if (isDirectory) {
        const files = await FileSystem.readDirectoryAsync(path);
        itemCount = files.length;
      }

      return {
        name: path.split('/').pop() || '',
        path: path,
        isDirectory,
        size: 'size' in stats ? stats.size : 0,
        modifiedTime: new Date().toISOString(),
        itemCount: isDirectory ? itemCount : undefined
      };
    }
  } catch (error) {
    console.error('Error getting file info:', error);
    throw error;
  }
};

// Function to read directory contents
export const readDirectory = async (path: string): Promise<FileItem[]> => {
  try {
    if (Platform.OS === 'android') {
      // Use RNFS for better Android file access
      const files = await RNFS.readDir(path);
      const fileItems: FileItem[] = [];

      for (const file of files) {
        try {
          const stats = await RNFS.stat(file.path);
          const isDirectory = stats.isDirectory();
          
          let itemCount = 0;
          if (isDirectory) {
            try {
              const subFiles = await RNFS.readDir(file.path);
              itemCount = subFiles.length;
            } catch (error) {
              console.warn(`Could not read subdirectory ${file.path}:`, error);
            }
          }

          fileItems.push({
            name: file.name,
            path: file.path,
            isDirectory,
            size: stats.size,
            modifiedTime: new Date(stats.mtime).toISOString(),
            itemCount: isDirectory ? itemCount : undefined
          });
        } catch (error) {
          console.warn(`Error getting info for ${file.name}:`, error);
        }
      }

      return fileItems.sort((a, b) => {
        // Directories first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // Then alphabetically
        return a.name.localeCompare(b.name);
      });
    } else {
      // Use Expo FileSystem for iOS
      const files = await FileSystem.readDirectoryAsync(path);
      const fileItems: FileItem[] = [];

      for (const file of files) {
        const fullPath = `${path}/${file}`;
        try {
          const fileInfo = await getFileInfo(fullPath);
          fileItems.push(fileInfo);
        } catch (error) {
          console.warn(`Error getting info for ${file}:`, error);
        }
      }

      return fileItems.sort((a, b) => {
        // Directories first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        // Then alphabetically
        return a.name.localeCompare(b.name);
      });
    }
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
};

// Enhanced function to create a new file
export const createFile = async (path: string, content: string = ''): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      await RNFS.writeFile(path, content, 'utf8');
    } else {
      await FileSystem.writeAsStringAsync(path, content);
    }
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
};

// Enhanced function to create a new directory
export const createDirectory = async (path: string): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      await RNFS.mkdir(path);
    } else {
      await FileSystem.makeDirectoryAsync(path, { intermediates: true });
    }
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
};

// Enhanced function to rename a file or directory
export const renameItem = async (oldPath: string, newPath: string): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      await RNFS.moveFile(oldPath, newPath);
    } else {
      await FileSystem.moveAsync({
        from: oldPath,
        to: newPath
      });
    }
  } catch (error) {
    console.error('Error renaming item:', error);
    throw error;
  }
};

// Enhanced function to delete a file or directory
export const deleteItem = async (path: string): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      const stats = await RNFS.stat(path);
      if (stats.isDirectory()) {
        await RNFS.unlink(path);
      } else {
        await RNFS.unlink(path);
      }
    } else {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        throw new Error('Item does not exist');
      }

      if (info.isDirectory) {
        const items = await FileSystem.readDirectoryAsync(path);
        for (const item of items) {
          const itemPath = `${path}/${item}`;
          await RNFS.unlink(itemPath);
        }
        await RNFS.unlink(path);
      } else {
        await RNFS.unlink(path);
      }
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

// Function to search for files and directories
export const searchItems = async (path: string, query: string): Promise<string[]> => {
  try {
    const results: string[] = [];
    const searchInDirectory = async (dirPath: string) => {
      const items = await FileSystem.readDirectoryAsync(dirPath);
      
      for (const item of items) {
        const fullPath = `${dirPath}/${item}`;
        if (item.toLowerCase().includes(query.toLowerCase())) {
          results.push(fullPath);
        }
        
        const itemInfo = await FileSystem.getInfoAsync(fullPath);
        if (itemInfo.isDirectory) {
          await searchInDirectory(fullPath);
        }
      }
    };

    await searchInDirectory(path);
    return results;
  } catch (error) {
    console.error('Error searching items:', error);
    throw error;
  }
};

// Function to get storage info
export const getStorageInfo = async (): Promise<{ total: number; used: number; free: number }> => {
  try {
    const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
    const totalDiskCapacity = await FileSystem.getTotalDiskCapacityAsync();
    
    return {
      total: totalDiskCapacity,
      used: totalDiskCapacity - freeDiskStorage,
      free: freeDiskStorage
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    throw error;
  }
};

export const getDirectoryContents = async (path: string) => {
  try {
    const contents = await FileSystem.readDirectoryAsync(path);
    const files = [];
    const folders = [];

    for (const item of contents) {
      const itemPath = `${path}/${item}`;
      const info = await FileSystem.getInfoAsync(itemPath);
      if (info.exists) {
        if (info.isDirectory) {
          folders.push({ name: item, path: itemPath, uri: info.uri });
        } else {
          files.push({ name: item, path: itemPath, uri: info.uri, size: info.size, modificationTime: info.modificationTime });
        }
      }
    }
    return { files, folders };
  } catch (error: any) {
    console.error(`Error reading directory ${path}:`, error);
    throw new Error(`Failed to read directory: ${error.message}`);
  }
};

export const createFolder = async (parentPath: string, folderName: string) => {
  const newFolderPath = `${parentPath}/${folderName}`;
  
  try {
    // Check permissions first
    const permissionsGranted = await checkAndRequestPermissions();
    if (!permissionsGranted) {
      throw new Error('Storage permissions not granted');
    }

    if (Platform.OS === 'android') {
      // Use RNFS for Android
      await RNFS.mkdir(newFolderPath);
    } else {
      // Use Expo FileSystem for iOS
      await FileSystem.makeDirectoryAsync(newFolderPath, { intermediates: true });
    }
    
    return newFolderPath;
  } catch (error: any) {
    if (error.code === 'EEXIST') {
      throw new Error(`Folder '${folderName}' already exists.`);
    } else {
      console.error(`Error creating folder ${newFolderPath}:`, error);
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }
};

// Enhanced function to copy files/directories
export const copyItem = async (fromPath: string, toPath: string, overwrite: boolean = false): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      const stats = await RNFS.stat(fromPath);
      if (stats.isDirectory()) {
        await RNFS.copyFile(fromPath, toPath);
      } else {
        await RNFS.copyFile(fromPath, toPath);
      }
    } else {
      // Use Expo FileSystem for iOS
      const content = await FileSystem.readAsStringAsync(fromPath);
      await FileSystem.writeAsStringAsync(toPath, content);
    }
  } catch (error) {
    console.error('Error copying item:', error);
    throw error;
  }
};

// Enhanced function to move files/directories
export const moveItem = async (fromPath: string, toPath: string, overwrite: boolean = false): Promise<void> => {
  try {
    if (Platform.OS === 'android') {
      await RNFS.moveFile(fromPath, toPath);
    } else {
      await FileSystem.moveAsync({
        from: fromPath,
        to: toPath
      });
    }
  } catch (error) {
    console.error('Error moving item:', error);
    throw error;
  }
};

// Function to get all available storage paths on Android
export const getAvailableStoragePaths = async (): Promise<string[]> => {
  if (Platform.OS !== 'android') {
    return [FileSystem.documentDirectory || ''];
  }

  try {
    const paths: string[] = [];
    
    // Internal storage
    paths.push('/storage/emulated/0');
    
    // Check for SD card
    try {
      const sdCardPath = '/storage/sdcard1';
      const sdCardExists = await RNFS.exists(sdCardPath);
      if (sdCardExists) {
        paths.push(sdCardPath);
      }
    } catch (error) {
      console.warn('SD card not found:', error);
    }

    // Check for external storage
    try {
      const externalPath = '/storage/emulated/0/Android/data';
      const externalExists = await RNFS.exists(externalPath);
      if (externalExists) {
        paths.push(externalPath);
      }
    } catch (error) {
      console.warn('External storage not accessible:', error);
    }

    return paths;
  } catch (error) {
    console.error('Error getting storage paths:', error);
    return ['/storage/emulated/0'];
  }
};

// Function to check if a path is accessible
export const isPathAccessible = async (path: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      // Use RNFS for better Android file access
      const exists = await RNFS.exists(path);
      if (!exists) {
        return false;
      }
      
      // Try to read the directory to ensure we have access
      try {
        await RNFS.readDir(path);
        return true;
      } catch (readError) {
        console.warn(`Cannot read directory ${path}:`, readError);
        return false;
      }
    } else {
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    }
  } catch (error) {
    console.warn(`Path ${path} not accessible:`, error);
    return false;
  }
};

// Function to get file permissions (Android only)
export const getFilePermissions = async (path: string): Promise<string> => {
  if (Platform.OS !== 'android') {
    return '';
  }

  try {
    const stats = await RNFS.stat(path);
    return stats.mode.toString();
  } catch (error) {
    console.error('Error getting file permissions:', error);
    return '';
  }
};

// Function to set file permissions (Android only)
export const setFilePermissions = async (path: string, permissions: string): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    // Use alternative method since chmod is not available
    await RNFS.writeFile(path, await RNFS.readFile(path), { mode: parseInt(permissions, 8) });
  } catch (error) {
    console.error('Error setting file permissions:', error);
    throw error;
  }
};

// Placeholder for progress reporting - FileSystem.downloadAsync and uploadAsync support progress callbacks
export const downloadFileWithProgress = async (uri: string, localPath: string, onProgress: (progress: number) => void) => {
  try {
    const options = {
      sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      cache: true,
      md5: false,
    };

    // Use 'as any' on the function itself to bypass strict argument checking
    const { uri: downloadedUri } = await (FileSystem.downloadAsync as any)(
      uri,
      localPath,
      options,
      (downloadProgress: any) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress(progress);
      }
    );
    return downloadedUri;
  } catch (error: any) {
    console.error(`Error downloading file ${uri}:`, error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

// Helper to format bytes to GB
export const formatBytesToGB = (bytes: number) => {
  if (bytes === 0) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}; 

/**
 * Comprehensive permission checker for file manager functionality
 * Handles both Android 13+ and older versions
 */
export const checkAndRequestPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      // For Android 13+ (API 33+), we need different permissions
      if (Platform.Version >= 33) {
        // Request READ_MEDIA_* permissions for Android 13+
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        // Check if all permissions are granted
        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permission Required',
            'This file manager needs access to your media files. For full access to all files, please grant "All files access" in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          return false;
        }

        // For Android 13+, also request MANAGE_EXTERNAL_STORAGE for full access
        // Note: This requires special handling as it's not available in PermissionsAndroid
        Alert.alert(
          'Full Access Required',
          'For complete file manager functionality, please grant "All files access" permission in your device settings:\n\n1. Go to Settings > Apps > File Manager\n2. Tap "Permissions"\n3. Enable "All files access"',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );

        return true;
      } else {
        // For Android 12 and below, use the old permissions
        const readGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Access Required',
            message: 'This file manager needs access to your files to work properly.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        const writeGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Access Required',
            message: 'This file manager needs access to your files to work properly.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (readGranted !== PermissionsAndroid.RESULTS.GRANTED || 
            writeGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Required',
            'Please grant storage permissions to use this file manager.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          return false;
        }

        // For older Android versions, also request MANAGE_EXTERNAL_STORAGE
        Alert.alert(
          'Full Access Required',
          'For complete file manager functionality, please grant "All files access" permission in your device settings:\n\n1. Go to Settings > Apps > File Manager\n2. Tap "Permissions"\n3. Enable "All files access"',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      }

      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Media Library Permission Required',
          'Please grant media library permission to access your media files.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return false;
      }

      return true;
    }

    // For iOS, permissions are handled differently
    return true;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
};

/**
 * Check if all required permissions are granted
 */
export const checkPermissionsStatus = async (): Promise<{
  storage: boolean;
  media: boolean;
  allGranted: boolean;
}> => {
  try {
    if (Platform.OS === 'android') {
      let storageGranted = false;
      
      if (Platform.Version >= 33) {
        // Check Android 13+ permissions
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        storageGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Check older Android permissions
        const readStatus = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        const writeStatus = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        );
        storageGranted = readStatus && writeStatus;
      }

      // Check media library permission
      const { status } = await MediaLibrary.getPermissionsAsync();
      const mediaGranted = status === 'granted';

      return {
        storage: storageGranted,
        media: mediaGranted,
        allGranted: storageGranted && mediaGranted,
      };
    }

    return {
      storage: true,
      media: true,
      allGranted: true,
    };
  } catch (error) {
    console.error('Error checking permission status:', error);
    return {
      storage: false,
      media: false,
      allGranted: false,
    };
  }
}; 

// Function to check if app has full file access (MANAGE_EXTERNAL_STORAGE)
export const hasFullFileAccess = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // Check if we've already verified full access
    const hasVerifiedAccess = await AsyncStorage.getItem('hasVerifiedFullAccess');
    if (hasVerifiedAccess === 'true') {
      return true;
    }

    // Test multiple paths that require full access
    const testPaths = [
      '/storage/emulated/0/Android/data',
      '/storage/emulated/0/Android/obb',
      '/storage/emulated/0/Android/media'
    ];
    
    for (const testPath of testPaths) {
      try {
        const exists = await RNFS.exists(testPath);
        if (exists) {
          // Try to read the directory to ensure we have access
          try {
            await RNFS.readDir(testPath);
            console.log(`Full file access confirmed via ${testPath}`);
            // Store that we've verified access
            await AsyncStorage.setItem('hasVerifiedFullAccess', 'true');
            return true;
          } catch (readError) {
            console.warn(`Cannot read ${testPath}:`, readError);
          }
        }
      } catch (error) {
        console.warn(`Cannot access ${testPath}:`, error);
      }
    }
    
    console.warn('Full file access not available');
    return false;
  } catch (error) {
    console.warn('Error checking full file access:', error);
    return false;
  }
};

// Function to request full file access
export const requestFullFileAccess = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // Check if we've already shown the instructions
    const hasShownInstructions = await AsyncStorage.getItem('hasShownFullAccessInstructions');
    if (hasShownInstructions === 'true') {
      return false;
    }

    // Store that we've shown the instructions
    await AsyncStorage.setItem('hasShownFullAccessInstructions', 'true');

    // Show the instructions alert
    Alert.alert(
      'Full Access Required',
      'For complete file manager functionality, please grant "All files access" permission in your device settings:\n\n1. Go to Settings > Apps > File Manager\n2. Tap "Permissions"\n3. Enable "All files access"',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]
    );

    return false;
  } catch (error) {
    console.error('Error requesting full file access:', error);
    return false;
  }
};

// Add a function to reset the permission state (useful for testing)
export const resetPermissionState = async () => {
  try {
    await AsyncStorage.removeItem('hasVerifiedFullAccess');
    await AsyncStorage.removeItem('hasShownFullAccessInstructions');
  } catch (error) {
    console.error('Error resetting permission state:', error);
  }
};

// Function to show detailed instructions for enabling full file access
export const showFullAccessInstructions = () => {
  const instructions = Platform.OS === 'android' && Platform.Version >= 30 
    ? `To enable "All files access" on Android 11+:\n\n1. Go to Settings > Apps > File Manager\n2. Tap "Permissions"\n3. Find "All files access" or "Files and media"\n4. Enable "Allow management of all files"\n5. Return to this app`
    : `To enable full file access:\n\n1. Go to Settings > Apps > File Manager\n2. Tap "Permissions"\n3. Enable "Storage" or "Files and media"\n4. Return to this app`;

  Alert.alert(
    'Full File Access Required',
    instructions,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings(),
      },
      {
        text: 'Check Again',
        onPress: async () => {
          const hasAccess = await hasFullFileAccess();
          if (hasAccess) {
            Alert.alert('Success', 'Full file access is now enabled!');
          } else {
            Alert.alert('Access Denied', 'Please enable "All files access" permission in settings.');
          }
        },
      },
    ]
  );
};

// Function to get all accessible storage locations
export const getAllStorageLocations = async (): Promise<string[]> => {
  if (Platform.OS !== 'android') {
    return [FileSystem.documentDirectory || ''];
  }

  const locations: string[] = [];
  
  try {
    // Internal storage
    locations.push('/storage/emulated/0');
    
    // Check for SD card
    try {
      const sdCardPath = '/storage/sdcard1';
      const exists = await RNFS.exists(sdCardPath);
      if (exists) {
        locations.push(sdCardPath);
      }
    } catch (error) {
      console.warn('SD card not accessible:', error);
    }

    // Check for external storage
    try {
      const externalPath = '/storage/emulated/0/Android/data';
      const exists = await RNFS.exists(externalPath);
      if (exists) {
        locations.push(externalPath);
      }
    } catch (error) {
      console.warn('External storage not accessible:', error);
    }

    // Check for system directories if we have full access
    const hasFullAccess = await hasFullFileAccess();
    if (hasFullAccess) {
      try {
        const systemPaths = [
          '/system',
          '/data',
          '/cache',
          '/storage/emulated/0/Android/obb'
        ];
        
        for (const path of systemPaths) {
          try {
            const exists = await RNFS.exists(path);
            if (exists) {
              locations.push(path);
            }
          } catch (error) {
            console.warn(`System path ${path} not accessible:`, error);
          }
        }
      } catch (error) {
        console.warn('System directories not accessible:', error);
      }
    }
  } catch (error) {
    console.error('Error getting storage locations:', error);
  }

  return locations;
}; 

interface FileCache {
  files: FileItem[];
  lastUpdated: number;
  directories: {
    [path: string]: {
      files: FileItem[];
      lastUpdated: number;
    }
  };
}

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 100;

export const scanFilesOptimized = async (
  directories: string[],
  fileTypes: string[],
  useCache: boolean = true
): Promise<FileItem[]> => {
  try {
    if (useCache) {
      const cachedData = await AsyncStorage.getItem('fileCache');
      if (cachedData) {
        const cache: FileCache = JSON.parse(cachedData);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - cache.lastUpdated < CACHE_EXPIRY) {
          return cache.files.filter(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            return fileTypes.includes(ext || '');
          });
        }
      }
    }

    let allFiles: FileItem[] = [];
    const newCache: FileCache = {
      files: [],
      lastUpdated: Date.now(),
      directories: {}
    };

    for (const dir of directories) {
      try {
        const items = await RNFS.readDir(dir);
        let batch: FileItem[] = [];
        
        for (const item of items) {
          if (!item.isDirectory()) {
            const ext = item.name.toLowerCase().split('.').pop();
            if (fileTypes.includes(ext || '')) {
              const fileItem: FileItem = {
                name: item.name,
                path: item.path,
                isDirectory: false,
                size: item.size,
                modifiedTime: new Date(item.mtime || Date.now()).toISOString()
              };
              batch.push(fileItem);
              
              // Process in batches
              if (batch.length >= BATCH_SIZE) {
                allFiles = [...allFiles, ...batch];
                batch = [];
              }
            }
          }
        }
        
        // Add remaining items
        if (batch.length > 0) {
          allFiles = [...allFiles, ...batch];
        }

        // Update cache for this directory
        newCache.directories[dir] = {
          files: allFiles,
          lastUpdated: Date.now()
        };
      } catch (error) {
        console.warn(`Error reading directory ${dir}:`, error);
      }
    }

    // Update the cache
    newCache.files = allFiles;
    if (useCache) {
      await AsyncStorage.setItem('fileCache', JSON.stringify(newCache));
    }

    return allFiles;
  } catch (error) {
    console.error('Error in scanFilesOptimized:', error);
    return [];
  }
};

// Helper function to clear the file cache
export const clearFileCache = async () => {
  try {
    await AsyncStorage.removeItem('fileCache');
  } catch (error) {
    console.error('Error clearing file cache:', error);
  }
}; 