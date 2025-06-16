import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getRecycleBinItems, restoreFromRecycleBin, permanentlyDeleteFromRecycleBin } from '../utils/RecycleBin';
import { formatBytesToGB } from '../utils/FileManagement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RootStackParamList = {
  Home: undefined;
  RecycleBin: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RecycleBin'>;

interface RecycleBinItem {
  name: string;
  path: string;
  originalPath: string;
  deletedAt: number;
  size?: number;
  isFile: boolean;
}

const { width } = Dimensions.get('window');

const RecycleBinScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const recycleBinItems = await getRecycleBinItems();
      setItems(recycleBinItems);
    } catch (error: any) {
      Alert.alert('Error', `Failed to load recycle bin items: ${error.message}`);
    }
  };

  const handleRestore = async (item: RecycleBinItem) => {
    try {
      await restoreFromRecycleBin(item.path);
      await loadItems();
      Alert.alert('Success', 'Item restored successfully');
    } catch (error: any) {
      Alert.alert('Error', `Failed to restore item: ${error.message}`);
    }
  };

  const handleDelete = async (item: RecycleBinItem) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to permanently delete this item? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await permanentlyDeleteFromRecycleBin(item.path);
              await loadItems();
            } catch (error: any) {
              Alert.alert('Error', `Failed to delete item: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleRestoreSelected = async () => {
    try {
      const selectedPaths = items
        .filter(item => selectedItems.includes(item.path))
        .map(item => item.path);

      for (const path of selectedPaths) {
        await restoreFromRecycleBin(path);
      }
      await loadItems();
      setSelectedItems([]);
      Alert.alert('Success', 'Selected items restored successfully');
    } catch (error: any) {
      Alert.alert('Error', `Failed to restore items: ${error.message}`);
    }
  };

  const handleDeleteSelected = async () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to permanently delete the selected items? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const selectedPaths = items
                .filter(item => selectedItems.includes(item.path))
                .map(item => item.path);

              for (const path of selectedPaths) {
                await permanentlyDeleteFromRecycleBin(path);
              }
              await loadItems();
              setSelectedItems([]);
            } catch (error: any) {
              Alert.alert('Error', `Failed to delete items: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const toggleItemSelection = (path: string) => {
    setSelectedItems(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const renderItem = ({ item }: { item: RecycleBinItem }) => (
    <TouchableOpacity
      style={[
        styles.itemContainer,
        selectedItems.includes(item.path) && styles.selectedItem
      ]}
      onPress={() => toggleItemSelection(item.path)}
      onLongPress={() => toggleItemSelection(item.path)}
    >
      <View style={styles.itemIconContainer}>
        <MaterialIcons
          name={item.isFile ? 'insert-drive-file' : 'folder'}
          size={28}
          color={item.isFile ? '#ccc' : '#6EC1E4'}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemDetailsContainer}>
          <View style={styles.itemDetail}>
            <MaterialIcons name="access-time" size={14} color="#666" />
            <Text style={styles.itemDetails}>
              {new Date(item.deletedAt).toLocaleString()}
            </Text>
          </View>
          {item.size !== undefined && (
            <View style={styles.itemDetail}>
              <MaterialIcons name="storage" size={14} color="#666" />
              <Text style={styles.itemDetails}>{formatBytesToGB(item.size)}</Text>
            </View>
          )}
        </View>
      </View>
      {selectedItems.includes(item.path) ? (
        <MaterialIcons name="check-circle" size={24} color="#B5E61D" />
      ) : (
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRestore(item)}
          >
            <MaterialIcons name="restore" size={24} color="#B5E61D" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
          >
            <MaterialIcons name="delete-forever" size={24} color="#F67280" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#6EC1E4" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recycle Bin</Text>
        </View>
        {selectedItems.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleRestoreSelected}
            >
              <MaterialIcons name="restore" size={24} color="#B5E61D" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleDeleteSelected}
            >
              <MaterialIcons name="delete-forever" size={24} color="#F67280" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.path}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="delete" size={48} color="#555" />
            <Text style={styles.emptyText}>Recycle bin is empty</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    color: '#6EC1E4',
    fontSize: 16,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  headerActionButton: {
    padding: 5,
  },
  listContent: {
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#111',
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  selectedItem: {
    backgroundColor: '#1a1a1a',
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  itemDetailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8,
  },
  itemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemDetails: {
    color: '#666',
    fontSize: 12,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    padding: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyText: {
    color: '#555',
    fontSize: 16,
    marginTop: 12,
  },
});

export default RecycleBinScreen; 