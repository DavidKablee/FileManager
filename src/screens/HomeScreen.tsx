import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeContext } from '../utils/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';

type RootStackParamList = {
  Home: undefined;
  FileExplorer: { initialPath: string; title: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const QuickAccessCard = ({ icon, title, subtitle, onPress, theme, gradientColors }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.quickAccessCard,
      {
        backgroundColor: theme.itemBackground,
        shadowColor: theme.shadowColor,
        shadowOpacity: theme.shadowOpacity,
        shadowRadius: theme.shadowRadius,
        shadowOffset: theme.shadowOffset,
        elevation: theme.elevation,
      }
    ]}
  >
    <LinearGradient
      colors={gradientColors}
      style={styles.iconContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <MaterialIcons name={icon} size={32} color="#fff" />
    </LinearGradient>
    <View style={styles.cardContent}>
      <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.cardSubtitle, { color: theme.secondaryText }]}>{subtitle}</Text>
    </View>
  </TouchableOpacity>
);

const StorageCard = ({ theme }: { theme: any }) => (
  <LinearGradient
    colors={[theme.primary, theme.primary + '80']}
    style={styles.storageCard}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
  >
    <View style={styles.storageHeader}>
      <MaterialIcons name="storage" size={24} color="#fff" />
      <Text style={styles.storageTitle}>Storage Overview</Text>
    </View>
    <View style={styles.storageStats}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>1.2 GB</Text>
        <Text style={styles.statLabel}>Used</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>4.8 GB</Text>
        <Text style={styles.statLabel}>Free</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>6 GB</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
    </View>
  </LinearGradient>
);

const HomeScreen: React.FC = () => {
  const { theme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  const getDocumentsPath = async () => {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        throw new Error('Document directory not available');
      }
      return documentsDir;
    } catch (error) {
      console.error('Error getting documents path:', error);
      return FileSystem.documentDirectory || '';
    }
  };

  const getPicturesPath = async () => {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        throw new Error('Document directory not available');
      }
      const picturesDir = documentsDir + 'Pictures/';
      const dirInfo = await FileSystem.getInfoAsync(picturesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(picturesDir, { intermediates: true });
      }
      return picturesDir;
    } catch (error) {
      console.error('Error getting pictures path:', error);
      return (FileSystem.documentDirectory || '') + 'Pictures/';
    }
  };

  const getMusicPath = async () => {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        throw new Error('Document directory not available');
      }
      const musicDir = documentsDir + 'Music/';
      const dirInfo = await FileSystem.getInfoAsync(musicDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(musicDir, { intermediates: true });
      }
      return musicDir;
    } catch (error) {
      console.error('Error getting music path:', error);
      return (FileSystem.documentDirectory || '') + 'Music/';
    }
  };

  const getVideosPath = async () => {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        throw new Error('Document directory not available');
      }
      const videosDir = documentsDir + 'Videos/';
      const dirInfo = await FileSystem.getInfoAsync(videosDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(videosDir, { intermediates: true });
      }
      return videosDir;
    } catch (error) {
      console.error('Error getting videos path:', error);
      return (FileSystem.documentDirectory || '') + 'Videos/';
    }
  };

  const quickAccessItems = [
    {
      icon: 'folder',
      title: 'Documents',
      subtitle: 'Access your documents',
      onPress: async () => {
        const path = await getDocumentsPath();
        navigation.navigate('FileExplorer', { initialPath: path, title: 'Documents' });
      },
      gradientColors: ['#4CAF50', '#45a049'],
    },
    {
      icon: 'image',
      title: 'Pictures',
      subtitle: 'View your images',
      onPress: async () => {
        const path = await getPicturesPath();
        navigation.navigate('FileExplorer', { initialPath: path, title: 'Pictures' });
      },
      gradientColors: ['#2196F3', '#1e88e5'],
    },
    {
      icon: 'music-note',
      title: 'Music',
      subtitle: 'Listen to your music',
      onPress: async () => {
        const path = await getMusicPath();
        navigation.navigate('FileExplorer', { initialPath: path, title: 'Music' });
      },
      gradientColors: ['#9C27B0', '#8e24aa'],
    },
    {
      icon: 'movie',
      title: 'Videos',
      subtitle: 'Watch your videos',
      onPress: async () => {
        const path = await getVideosPath();
        navigation.navigate('FileExplorer', { initialPath: path, title: 'Videos' });
      },
      gradientColors: ['#FF5722', '#f4511e'],
    },
    {
      icon: 'sd-card',
      title: 'SD-Card',
      subtitle: '......',
      onPress: async () => {
        const path = await getVideosPath();
        navigation.navigate('FileExplorer', { initialPath: path, title: 'SD-Card' });
      },
      gradientColors: ['#FF5722', '#f4511e'],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.appName, { color: theme.primary }]}>
            File Manager
          </Text>
        </View>

        <StorageCard theme={theme} />

        <View style={styles.quickAccessSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Quick Access
          </Text>
          <View style={styles.quickAccessGrid}>
            {quickAccessItems.map((item, index) => (
              <QuickAccessCard
                key={index}
                {...item}
                theme={theme}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '300',
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 5,
  },
  quickAccessSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAccessCard: {
    width: (width - 50) / 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
  },
  storageCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  storageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  storageStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#fff',
    opacity: 0.3,
  },
});

export default HomeScreen; 