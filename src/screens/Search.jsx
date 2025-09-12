import { useEffect, useMemo, useRef, useState } from 'react';
import { 
  ActivityIndicator, 
  FlatList, 
  Pressable, 
  Text, 
  TextInput, 
  View, 
  StyleSheet, 
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { searchVerses } from '../lib/queries';
import { BOOKS } from '../lib/books';
import { Ionicons } from '@expo/vector-icons'; // Or use text icons if unavailable

const { width } = Dimensions.get('window');

export default function SearchScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const debouncedQ = useDebounce(q.trim(), 300);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputSlideAnim = useRef(new Animated.Value(-30)).current;
  const resultsSlideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    let cancelled = false;
    setPage(0);

    const run = async () => {
      if (debouncedQ.length < 2) {
        setRes([]);
        setLoading(false);
        setErr(null);
        return;
      }
      try {
        setLoading(true);
        setErr(null);
        const rows = await searchVerses(debouncedQ, { limit: PAGE_SIZE, offset: 0 });
        if (!cancelled) {
          setRes(rows ?? []);
          
          // Animate in results
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(resultsSlideAnim, {
              toValue: 0,
              duration: 500,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            })
          ]).start();
        }
      } catch (e) {
        if (!cancelled) setErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();

    return () => { cancelled = true; };
  }, [debouncedQ]);

  useEffect(() => {
    // Animate input on mount
    Animated.timing(inputSlideAnim, {
      toValue: 0,
      duration: 500,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, []);

  const loadMore = async () => {
    if (loading || debouncedQ.length < 2) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const more = await searchVerses(debouncedQ, { limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE });
      if (more?.length) {
        setRes(prev => [...prev, ...more]);
        setPage(nextPage);
      }
    } finally {
      setLoading(false);
    }
  };

  const keyExtractor = (item, idx) => `${item.Book}-${item.Chapter}-${item.Versecount}-${idx}`;

  const SearchResultItem = ({ item, index }) => {
    const itemSlideAnim = useRef(new Animated.Value(50)).current;
    
    useEffect(() => {
      Animated.timing(itemSlideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View 
        style={{ 
          transform: [{ translateX: itemSlideAnim }],
          opacity: fadeAnim
        }}
      >
        <Pressable
          onPress={() => navigation.navigate('Verses', { book: item.Book, chapter: item.Chapter })}
          style={({ pressed }) => [
            styles.resultItem,
            { backgroundColor: pressed ? colors.primaryLight + '10' : colors.surface }
          ]}
        >
          <View style={styles.resultHeader}>
            <Text style={styles.reference}>
              {BOOKS[item.Book]} {item.Chapter}:{item.Versecount}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </View>
          <Highlighted text={item.verse} query={debouncedQ} />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <Animated.View 
        style={[
          styles.searchHeader,
          { 
            opacity: fadeAnim,
            transform: [{ translateX: inputSlideAnim }] 
          }
        ]}
      >
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search scriptures..."
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setQ(q)}
            clearButtonMode="while-editing"
            style={styles.searchInput}
          />
        </View>
        {debouncedQ.length >= 2 && (
          <Text style={styles.searchInfo}>
            {res.length} result{res.length !== 1 ? 's' : ''} found
          </Text>
        )}
      </Animated.View>

      {err && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={20} color={colors.error} />
          <Text style={styles.errorText}>Search failed. Please try again.</Text>
        </View>
      )}

      {loading && res.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching for "{debouncedQ}"...</Text>
        </View>
      ) : (
        <Animated.View 
          style={[
            styles.resultsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: resultsSlideAnim }] 
            }
          ]}
        >
          <FlatList
            data={res}
            keyExtractor={keyExtractor}
            renderItem={({ item, index }) => <SearchResultItem item={item} index={index} />}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews
            onEndReachedThreshold={0.5}
            onEndReached={loadMore}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              debouncedQ.length >= 2 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>No results found</Text>
                  <Text style={styles.emptyText}>
                    No matches found for "{debouncedQ}". Try different keywords.
                  </Text>
                </View>
              ) : debouncedQ.length === 0 ? (
                <View style={styles.initialContainer}>
                  <Ionicons name="search" size={60} color={colors.textTertiary} />
                  <Text style={styles.initialTitle}>Search Scriptures</Text>
                  <Text style={styles.initialText}>
                    Enter at least 2 characters to search through all books and verses.
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              loading && res.length > 0 ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.footerLoadingText}>Loading more results...</Text>
                </View>
              ) : null
            }
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function useDebounce(value, delay) {
  const [out, setOut] = useState(value);
  const t = useRef(null);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setOut(value), delay);
    return () => clearTimeout(t.current);
  }, [value, delay]);
  return out;
}

function Highlighted({ text, query }) {
  const content = String(text);
  if (!query) return <Text style={styles.verseText}>{content}</Text>;
  try {
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${esc})`, 'ig');
    const parts = content.split(re);
    return (
      <Text style={styles.verseText}>
        {parts.map((p, i) =>
          re.test(p) ? (
            <Text key={i} style={styles.highlightedText}>
              {p}
            </Text>
          ) : (
            <Text key={i}>{p}</Text>
          )
        )}
      </Text>
    );
  } catch {
    return <Text style={styles.verseText}>{content}</Text>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchHeader: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  searchInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  errorText: {
    marginLeft: 8,
    color: colors.error,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  resultsContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  resultItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    shadowColor: colors.textTertiary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reference: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  verseText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  highlightedText: {
    backgroundColor: colors.accent + '40',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  initialContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  initialText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoading: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  footerLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.textSecondary,
  },
});