import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: string;
  itemCount?: number;
}

// Get the base storage path based on platform
export const getBaseStoragePath = () => {
  return Platform.OS === 'android' 
    ? '/storage/emulated/0'  // Android internal storage path
    : FileSystem.documentDirectory; // iOS uses app's document directory
};

// Function to get file info
export const getFileInfo = async (path: string): Promise<FileItem> => {
  try {
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
  } catch (error) {
    console.error('Error getting file info:', error);
    throw error;
  }
};

// Function to read directory contents
export const readDirectory = async (path: string): Promise<FileItem[]> => {
  try {
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
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
};

// Function to create a new file
export const createFile = async (path: string, content: string = ''): Promise<void> => {
  try {
    await FileSystem.writeAsStringAsync(path, content);
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
};

// Function to create a new directory
export const createDirectory = async (path: string): Promise<void> => {
  try {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
};

// Function to rename a file or directory
export const renameItem = async (oldPath: string, newPath: string): Promise<void> => {
  try {
    await FileSystem.moveAsync({
      from: oldPath,
      to: newPath
    });
  } catch (error) {
    console.error('Error renaming item:', error);
    throw error;
  }
};

// Function to delete a file or directory
export const deleteItem = async (path: string): Promise<void> => {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      throw new Error('Item does not exist');
    }

    // For directories, we need to handle them differently
    if (info.isDirectory) {
      // First, get all items in the directory
      const items = await FileSystem.readDirectoryAsync(path);
      
      // Move each item to the recycle bin
      for (const item of items) {
        const itemPath = `${path}/${item}`;
        await moveToRecycleBin(itemPath);
      }
      
      // Finally, move the empty directory to the recycle bin
      await moveToRecycleBin(path);
    } else {
      // For files, just move them to the recycle bin
      await moveToRecycleBin(path);
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
    await FileSystem.makeDirectoryAsync(newFolderPath, { intermediates: true });
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

export const copyItem = async (fromPath: string, toPath: string, overwrite: boolean = false) => {
  try {
    const toInfo = await FileSystem.getInfoAsync(toPath);
    if (toInfo.exists && !overwrite) {
      throw new Error(`Item already exists at ${toPath}. Set overwrite to true to replace.`);
    }
    await FileSystem.copyAsync({
      from: fromPath,
      to: toPath,
    });
    return toPath;
  } catch (error: any) {
    console.error(`Error copying ${fromPath} to ${toPath}:`, error);
    throw new Error(`Failed to copy item: ${error.message}`);
  }
};

export const moveItem = async (fromPath: string, toPath: string, overwrite: boolean = false) => {
  try {
    const toInfo = await FileSystem.getInfoAsync(toPath);
    if (toInfo.exists && !overwrite) {
      throw new Error(`Item already exists at ${toPath}. Set overwrite to true to replace.`);
    }
    await FileSystem.moveAsync({
      from: fromPath,
      to: toPath,
    });
    return toPath;
  } catch (error: any) {
    console.error(`Error moving ${fromPath} to ${toPath}:`, error);
    throw new Error(`Failed to move item: ${error.message}`);
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