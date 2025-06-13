import * as FileSystem from 'expo-file-system';

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

export const createFile = async (parentPath: string, fileName: string, content: string = '') => {
  const newFilePath = `${parentPath}/${fileName}`;
  try {
    await FileSystem.writeAsStringAsync(newFilePath, content);
    return newFilePath;
  } catch (error: any) {
    console.error(`Error creating file ${newFilePath}:`, error);
    throw new Error(`Failed to create file: ${error.message}`);
  }
};

export const renameItem = async (oldPath: string, newPath: string) => {
  try {
    await FileSystem.moveAsync({
      from: oldPath,
      to: newPath,
    });
    return newPath;
  } catch (error: any) {
    console.error(`Error renaming ${oldPath} to ${newPath}:`, error);
    throw new Error(`Failed to rename item: ${error.message}`);
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

export const deleteItem = async (path: string) => {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      throw new Error(`Item at ${path} does not exist.`);
    }
    await FileSystem.deleteAsync(path, { idempotent: true });
    return true;
  } catch (error: any) {
    console.error(`Error deleting ${path}:`, error);
    throw new Error(`Failed to delete item: ${error.message}`);
  }
};

export const searchItems = async (directoryPath: string, query: string) => {
  try {
    const contents = await FileSystem.readDirectoryAsync(directoryPath);
    const searchResults = contents.filter(item => item.toLowerCase().includes(query.toLowerCase()));
    return searchResults.map(item => `${directoryPath}/${item}`);
  } catch (error: any) {
    console.error(`Error searching in ${directoryPath}:`, error);
    throw new Error(`Failed to search items: ${error.message}`);
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