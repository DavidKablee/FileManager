import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_FILES_KEY = '@recent_files';
const MAX_RECENT_FILES = 50;

export interface RecentFile {
  path: string;
  name: string;
  lastAccessed: number;
  isFile: boolean;
  size?: number;
}

export const addToRecentFiles = async (path: string) => {
  try {
    // Get file info
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return;

    // Get current recent files
    const recentFilesStr = await AsyncStorage.getItem(RECENT_FILES_KEY);
    const recentFiles: RecentFile[] = recentFilesStr ? JSON.parse(recentFilesStr) : [];

    // Create new recent file entry
    const newRecentFile: RecentFile = {
      path,
      name: path.split('/').pop() || '',
      lastAccessed: Date.now(),
      isFile: !info.isDirectory,
      size: info.size,
    };

    // Remove if already exists
    const filteredFiles = recentFiles.filter(file => file.path !== path);

    // Add new file to the beginning
    filteredFiles.unshift(newRecentFile);

    // Keep only the most recent files
    const trimmedFiles = filteredFiles.slice(0, MAX_RECENT_FILES);

    // Save back to storage
    await AsyncStorage.setItem(RECENT_FILES_KEY, JSON.stringify(trimmedFiles));
  } catch (error) {
    console.error('Error adding to recent files:', error);
  }
};

export const getRecentFiles = async (): Promise<RecentFile[]> => {
  try {
    const recentFilesStr = await AsyncStorage.getItem(RECENT_FILES_KEY);
    if (!recentFilesStr) return [];

    const recentFiles: RecentFile[] = JSON.parse(recentFilesStr);

    // Filter out files that no longer exist
    const validFiles = await Promise.all(
      recentFiles.map(async (file) => {
        const info = await FileSystem.getInfoAsync(file.path);
        return info.exists ? file : null;
      })
    );

    // Remove null entries (files that don't exist anymore)
    const filteredFiles = validFiles.filter((file): file is RecentFile => file !== null);

    // Update storage with only valid files
    await AsyncStorage.setItem(RECENT_FILES_KEY, JSON.stringify(filteredFiles));

    return filteredFiles;
  } catch (error) {
    console.error('Error getting recent files:', error);
    return [];
  }
};

export const clearRecentFiles = async () => {
  try {
    await AsyncStorage.removeItem(RECENT_FILES_KEY);
  } catch (error) {
    console.error('Error clearing recent files:', error);
  }
}; 