import { useEffect, useMemo, useState, useRef } from 'react';
import { 
  ActivityIndicator, 
  FlatList, 
  Pressable, 
  Text, 
  View, 
  StyleSheet, 
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; 
import { colors } from '../utils/colors';
import { getBookMaxChapter } from '../lib/queries';
import { BOOKS } from '../lib/books';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 5;
const ITEM_MARGIN = 6;
const ITEM_SIZE = (width - 48 - (ITEM_MARGIN * 2 * COLUMN_COUNT)) / COLUMN_COUNT;

export default function ChaptersScreen({ navigation, route }) {
  const b = useMemo(() => Number(route.params.book), [route.params.book]); // 0-based
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(true);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const itemsSlideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const m = await getBookMaxChapter(b);
        if (!cancelled) {
          setMax(m || 0);
          
          // Animate in content after loading
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(headerSlideAnim, {
              toValue: 0,
              duration: 500,
              easing: Easing.out(Easing.back(1.2)),
              useNativeDriver: true,
            }),
            Animated.timing(itemsSlideAnim, {
              toValue: 0,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            })
          ]).start();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [b]);

  const ChapterButton = ({ chapter, index }) => {
    const scaleValue = useRef(new Animated.Value(0.8)).current;
    const opacityValue = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          delay: index * 60,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 500,
          delay: index * 60,
          useNativeDriver: true,
        })
      ]).start();
    }, []);

    const onPressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };
    
    const onPressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 0.9,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        })
      ]).start(() => {
        navigation.navigate('Verses', { book: b, chapter: chapter });
      });
    };

    return (
      <Animated.View 
        style={{ 
          transform: [{ scale: scaleValue }],
          opacity: opacityValue
        }}
      >
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={handlePress}
          style={({ pressed }) => [
            styles.chapterButton,
            { 
              backgroundColor: pressed ? colors.primaryLight + '20' : colors.surface,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              margin: ITEM_MARGIN,
            }
          ]}
        >
          <Text style={styles.chapterNumber}>{chapter}</Text>
        </Pressable>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Chapters...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Animated.View 
          style={[
            styles.header,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: headerSlideAnim }] 
            }
          ]}
        >
          {/* Back Button */}
          <Pressable 
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Title Section */}
          <View style={styles.titleContainer}>
            <Text style={styles.bookTitle}>{BOOKS[b]}</Text>
            <Text style={styles.chaptersTitle}>Select a Chapter</Text>
          </View>

          {/* Chapter Count */}
          <View style={styles.chapterCount}>
            <Text style={styles.chapterCountText}>{max} Chapters</Text>
          </View>
        </Animated.View>
      </LinearGradient>

      <Animated.View 
        style={[
          styles.content,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: itemsSlideAnim }] 
          }
        ]}
      >
        <FlatList
          data={Array.from({ length: max }, (_, i) => i + 1)} // 1..max
          keyExtractor={(i) => String(i)}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item, index }) => (
            <ChapterButton chapter={item} index={index} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No chapters found for this book.</Text>
            </View>
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  headerGradient: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  bookTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    textAlign: 'center',
  },
  chaptersTitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  chapterCount: {
    backgroundColor: '#FFFFFF20',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginLeft: 8,
  },
  chapterCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24, // Extra padding at bottom to prevent cutoff
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  chapterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: colors.textTertiary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chapterNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});