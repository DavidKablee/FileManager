import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Get the recycle bin directory path
const getRecycleBinPath = () => {
  const basePath = Platform.OS === 'android' 
    ? '/storage/emulated/0'
    : FileSystem.documentDirectory;
  return `${basePath}/.recyclebin`;
};

// Initialize recycle bin directory
export const initializeRecycleBin = async () => {
  const recycleBinPath = getRecycleBinPath();
  const dirInfo = await FileSystem.getInfoAsync(recycleBinPath);
  
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(recycleBinPath, { intermediates: true });
  }
};

// Move item to recycle bin
export const moveToRecycleBin = async (path: string): Promise<void> => {
  try {
    const recycleBinPath = getRecycleBinPath();
    const fileName = path.split('/').pop() || '';
    const timestamp = new Date().getTime();
    const newPath = `${recycleBinPath}/${timestamp}_${fileName}`;

    // Create metadata file
    const metadata = {
      originalPath: path,
      deletedAt: timestamp,
      fileName: fileName
    };
    const metadataPath = `${newPath}.meta`;
    
    // Move the file and create metadata
    await FileSystem.moveAsync({
      from: path,
      to: newPath
    });
    await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error moving to recycle bin:', error);
    throw error;
  }
};

// Get all items in recycle bin
export const getRecycleBinItems = async () => {
  try {
    const recycleBinPath = getRecycleBinPath();
    const items = await FileSystem.readDirectoryAsync(recycleBinPath);
    
    const recycleBinItems = await Promise.all(
      items
        .filter(item => !item.endsWith('.meta'))
        .map(async (item) => {
          const metadataPath = `${recycleBinPath}/${item}.meta`;
          const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
          const metadata = JSON.parse(metadataContent);
          
          const fileInfo = await FileSystem.getInfoAsync(`${recycleBinPath}/${item}`);
          
          return {
            name: metadata.fileName,
            path: `${recycleBinPath}/${item}`,
            originalPath: metadata.originalPath,
            deletedAt: metadata.deletedAt,
            size: fileInfo.size,
            isFile: !fileInfo.isDirectory
          };
        })
    );
    
    return recycleBinItems;
  } catch (error) {
    console.error('Error getting recycle bin items:', error);
    throw error;
  }
};

// Restore item from recycle bin
export const restoreFromRecycleBin = async (path: string): Promise<void> => {
  try {
    const metadataPath = `${path}.meta`;
    const metadataContent = await FileSystem.readAsStringAsync(metadataPath);
    const metadata = JSON.parse(metadataContent);
    
    // Check if original location exists
    const originalDirInfo = await FileSystem.getInfoAsync(metadata.originalPath);
    if (originalDirInfo.exists) {
      throw new Error('Original location already exists');
    }
    
    // Move file back to original location
    await FileSystem.moveAsync({
      from: path,
      to: metadata.originalPath
    });
    
    // Delete metadata file
    await FileSystem.deleteAsync(metadataPath);
  } catch (error) {
    console.error('Error restoring from recycle bin:', error);
    throw error;
  }
};

// Permanently delete item from recycle bin
export const permanentlyDeleteFromRecycleBin = async (path: string): Promise<void> => {
  try {
    const metadataPath = `${path}.meta`;
    
    // Delete both the file and its metadata
    await FileSystem.deleteAsync(path);
    await FileSystem.deleteAsync(metadataPath);
  } catch (error) {
    console.error('Error permanently deleting from recycle bin:', error);
    throw error;
  }
}; 