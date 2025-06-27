import * as RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECYCLE_BIN_KEY = '@recycle_bin_items';
const RECYCLE_BIN_PATH = `${RNFS.ExternalStorageDirectoryPath}/.recyclebin`;

export type RecycleBinItem = {
  id: string;
  originalPath: string;
  originalName: string;
  recyclePath: string;
  deletedAt: string;
  size: number;
  type: string;
};

export const initializeRecycleBin = async () => {
  try {
    // Create recycle bin directory if it doesn't exist
    const exists = await RNFS.exists(RECYCLE_BIN_PATH);
    if (!exists) {
      await RNFS.mkdir(RECYCLE_BIN_PATH);
    }
  } catch (error) {
    console.error('Error initializing recycle bin:', error);
  }
};

export const moveToRecycleBin = async (filePath: string): Promise<boolean> => {
  try {
    const fileInfo = await RNFS.stat(filePath);
    if (fileInfo.isDirectory()) {
      return false; // Don't handle directories for now
    }

    // Generate unique ID for the file
    const id = Date.now().toString();
    const fileName = filePath.split('/').pop() || '';
    const recyclePath = `${RECYCLE_BIN_PATH}/${id}_${fileName}`;

    // Move file to recycle bin
    await RNFS.moveFile(filePath, recyclePath);

    // Create recycle bin item
    const item: RecycleBinItem = {
      id,
      originalPath: filePath,
      originalName: fileName,
      recyclePath,
      deletedAt: new Date().toISOString(),
      size: fileInfo.size,
      type: fileName.split('.').pop()?.toLowerCase() || 'unknown'
    };

    // Save item metadata
    const existingItems = await getRecycleBinItems();
    await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify([...existingItems, item]));

    return true;
  } catch (error) {
    console.error('Error moving file to recycle bin:', error);
    return false;
  }
};

export const getRecycleBinItems = async (): Promise<RecycleBinItem[]> => {
  try {
    const items = await AsyncStorage.getItem(RECYCLE_BIN_KEY);
    return items ? JSON.parse(items) : [];
  } catch (error) {
    console.error('Error getting recycle bin items:', error);
    return [];
  }
};

export const restoreFromRecycleBin = async (item: RecycleBinItem): Promise<boolean> => {
  try {
    // Check if original directory exists
    const originalDir = item.originalPath.substring(0, item.originalPath.lastIndexOf('/'));
    const originalDirExists = await RNFS.exists(originalDir);
    
    if (!originalDirExists) {
      await RNFS.mkdir(originalDir);
    }

    // Move file back to original location
    await RNFS.moveFile(item.recyclePath, item.originalPath);

    // Remove item from metadata
    const items = await getRecycleBinItems();
    const updatedItems = items.filter(i => i.id !== item.id);
    await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(updatedItems));

    return true;
  } catch (error) {
    console.error('Error restoring file from recycle bin:', error);
    return false;
  }
};

export const deleteFromRecycleBin = async (item: RecycleBinItem): Promise<boolean> => {
  try {
    // Delete the actual file
    await RNFS.unlink(item.recyclePath);

    // Remove item from metadata
    const items = await getRecycleBinItems();
    const updatedItems = items.filter(i => i.id !== item.id);
    await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(updatedItems));

    return true;
  } catch (error) {
    console.error('Error deleting file from recycle bin:', error);
    return false;
  }
};

export const emptyRecycleBin = async (): Promise<boolean> => {
  try {
    const items = await getRecycleBinItems();
    
    // Delete all files
    await Promise.all(items.map(item => RNFS.unlink(item.recyclePath)));
    
    // Clear metadata
    await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify([]));
    
    return true;
  } catch (error) {
    console.error('Error emptying recycle bin:', error);
    return false;
  }
}; 