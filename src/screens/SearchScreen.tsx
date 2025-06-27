import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as RNFS from 'react-native-fs';
import { formatFileSize } from '../utils/FileManagement';

type SearchResult = {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  type: string;
  isDirectory: boolean;
};

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const navigation = useNavigation();

  const getFileType = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'audio';
    if (['pdf', 'doc', 'docx', 'txt', 'xlsx'].includes(ext)) return 'document';
    if (ext === 'apk') return 'apk';
    return 'other';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <MaterialIcons name="image" size={24} color="#FF9800" />;
      case 'video':
        return <MaterialIcons name="videocam" size={24} color="#F44336" />;
      case 'audio':
        return <MaterialIcons name="audiotrack" size={24} color="#2196F3" />;
      case 'document':
        return <MaterialIcons name="description" size={24} color="#4CAF50" />;
      case 'apk':
        return <MaterialIcons name="android" size={24} color="#4CAF50" />;
      default:
        return <MaterialIcons name="insert-drive-file" size={24} color="#78909C" />;
    }
  };

  const searchFiles = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const searchQuery = query.toLowerCase();

    try {
      const directories = [
        RNFS.ExternalStorageDirectoryPath,
        RNFS.DownloadDirectoryPath,
        RNFS.ExternalStorageDirectoryPath + '/Documents',
        RNFS.ExternalStorageDirectoryPath + '/DCIM',
        RNFS.ExternalStorageDirectoryPath + '/Pictures',
        RNFS.ExternalStorageDirectoryPath + '/Music',
        RNFS.ExternalStorageDirectoryPath + '/Movies',
      ];

      let results: SearchResult[] = [];

      const searchDirectory = async (directory: string) => {
        try {
          const items = await RNFS.readDir(directory);
          
          for (const item of items) {
            // Check if the file/folder name matches the search query
            if (item.name.toLowerCase().includes(searchQuery)) {
              results.push({
                name: item.name,
                path: item.path,
                size: item.size,
                modifiedTime: new Date(item.mtime || Date.now()).toISOString(),
                type: item.isDirectory() ? 'folder' : getFileType(item.name),
                isDirectory: item.isDirectory(),
              });
            }

            // Recursively search in subdirectories
            if (item.isDirectory()) {
              await searchDirectory(item.path);
            }
          }
        } catch (error) {
          console.warn(`Error searching directory ${directory}:`, error);
        }
      };

      // Search all directories concurrently
      await Promise.all(directories.map(dir => searchDirectory(dir)));

      // Remove duplicates and sort by relevance
      const uniqueResults = Array.from(
        new Map(results.map(item => [item.path, item])).values()
      );

      // Sort results: exact matches first, then partial matches
      uniqueResults.sort((a, b) => {
        const aExact = a.name.toLowerCase() === searchQuery;
        const bExact = b.name.toLowerCase() === searchQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.name.localeCompare(b.name);
      });

      setSearchResults(uniqueResults);
      
      // Save to recent searches
      if (!recentSearches.includes(query)) {
        setRecentSearches(prev => [query, ...prev].slice(0, 5));
      }
    } catch (error) {
      console.error('Error during search:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const handleResultPress = (item: SearchResult) => {
    if (item.isDirectory) {
      navigation.navigate('FileExplorer', {
        initialPath: item.path,
        title: item.name,
      });
    } else {
      // Handle file opening based on type
      switch (item.type) {
        case 'image':
          navigation.navigate('ImageGallery');
          break;
        case 'video':
          navigation.navigate('VideoGallery');
          break;
        case 'audio':
          navigation.navigate('AudioGallery');
          break;
        case 'document':
          navigation.navigate('DocumentGallery');
          break;
        case 'apk':
          navigation.navigate('ApkGallery');
          break;
        default:
          console.log('Opening file:', item.path);
      }
    }
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress(item)}
    >
      <View style={styles.resultIcon}>
        {getFileIcon(item.type)}
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.resultPath} numberOfLines={1}>
          {item.path.replace(RNFS.ExternalStorageDirectoryPath, 'Storage')}
        </Text>
        <Text style={styles.resultDetails}>
          {formatDate(item.modifiedTime)} • {formatFileSize(item.size)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderRecentSearches = () => (
    <View style={styles.recentSearches}>
      <Text style={styles.recentTitle}>Recent Searches</Text>
      {recentSearches.map((search, index) => (
        <TouchableOpacity
          key={index}
          style={styles.recentItem}
          onPress={() => {
            setSearchQuery(search);
            searchFiles(search);
          }}
        >
          <MaterialIcons name="history" size={20} color="#888" />
          <Text style={styles.recentText}>{search}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search files and folders..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={text => {
              setSearchQuery(text);
              if (text.length >= 3) {
                searchFiles(text);
              }
            }}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <MaterialIcons name="close" size={20} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={item => item.path}
          contentContainerStyle={styles.resultsList}
        />
      ) : searchQuery ? (
        <View style={styles.noResults}>
          <MaterialIcons name="search-off" size={48} color="#888" />
          <Text style={styles.noResultsText}>No results found</Text>
        </View>
      ) : (
        renderRecentSearches()
      )}
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
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    marginRight: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: 'white',
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  resultIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: 'white',
    fontSize: 16,
    marginBottom: 2,
  },
  resultPath: {
    color: '#888',
    fontSize: 14,
    marginBottom: 2,
  },
  resultDetails: {
    color: '#666',
    fontSize: 12,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  recentSearches: {
    padding: 16,
  },
  recentTitle: {
    color: '#888',
    fontSize: 16,
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  recentText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 12,
  },
});

export default SearchScreen; 