import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as RNFS from 'react-native-fs';
import { formatFileSize } from '../utils/FileManagement';

type DocumentItem = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  type: string;
};

const DocumentGallery = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const navigation = useNavigation();

  const findDocuments = async (directory: string): Promise<DocumentItem[]> => {
    try {
      const items = await RNFS.readDir(directory);
      let docs: DocumentItem[] = [];

      for (const item of items) {
        if (item.isDirectory()) {
          // Recursively search in subdirectories
          const subDirDocs = await findDocuments(item.path);
          docs = [...docs, ...subDirDocs];
        } else {
          const ext = item.name.toLowerCase().split('.').pop();
          if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xlsx', 'xls', 'ppt', 'pptx'].includes(ext || '')) {
            docs.push({
              name: item.name,
              path: item.path,
              size: item.size,
              modifiedTime: new Date(item.mtime || Date.now()).toISOString(),
              type: ext || ''
            });
          }
        }
      }

      return docs;
    } catch (error) {
      console.warn(`Error reading directory ${directory}:`, error);
      return [];
    }
  };

  const loadDocuments = async () => {
    try {
      // Start search from the root storage directory
      const rootDir = RNFS.ExternalStorageDirectoryPath;
      const allDocs = await findDocuments(rootDir);

      // Calculate total size
      const totalDocsSize = allDocs.reduce((acc, curr) => acc + curr.size, 0);

      // Sort documents by date (newest first)
      const sortedDocs = allDocs.sort((a, b) => 
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
      );

      setTotalSize(totalDocsSize);
      setDocuments(sortedDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.subtitle}>{formatFileSize(totalSize)}</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialIcons name="sort" size={24} color="white" />
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderDocumentItem = ({ item }: { item: DocumentItem }) => (
    <TouchableOpacity style={styles.documentItem}>
      <View style={styles.thumbnailContainer}>
        {item.type === 'pdf' ? (
          <MaterialIcons name="picture-as-pdf" size={40} color="#F44336" />
        ) : (
          <MaterialIcons name="description" size={40} color="#2196F3" />
        )}
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.documentDate}>
          {formatDate(item.modifiedTime)}
        </Text>
      </View>
      <Text style={styles.documentSize}>
        {formatFileSize(item.size)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={documents}
        renderItem={renderDocumentItem}
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
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333'
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 4
  },
  documentInfo: {
    flex: 1,
    marginRight: 16
  },
  documentName: {
    color: 'white',
    fontSize: 16,
    marginBottom: 4
  },
  documentDate: {
    color: '#888888',
    fontSize: 12
  },
  documentSize: {
    color: '#888888',
    fontSize: 12,
    minWidth: 60,
    textAlign: 'right'
  }
});

export default DocumentGallery; 