import React, { useEffect, useRef, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { searchVerses } from '../lib/queries';
import { BOOKS } from '../lib/books';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function SearchScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const debouncedQ = useDebounce(q.trim(), 300);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  // Animation values - only animate on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Animate on mount only once
    if (!hasAnimated.current) {
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
        })
      ]).start();
      hasAnimated.current = true;
    }
  }, []);

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

  const SearchResultItem = React.memo(({ item, index }) => {
    return (
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
    );
  });

  return (
      <SafeAreaView style={styles.container} edges={['right', 'left']}>
        <StatusBar 
          style={"light"}
          backgroundColor={colors.primary}
        />
        <View style={{ flex: 1, backgroundColor: colors.background }}>
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

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#FFFFFF" style={styles.searchIcon} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search scriptures..."
                placeholderTextColor="#FFFFFF90"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => setQ(q)}
                clearButtonMode="while-editing"
                style={styles.searchInput}
              />
            </View>

            {/* Spacer for balance */}
            <View style={styles.headerSpacer} />
          </Animated.View>
        </LinearGradient>

        {debouncedQ.length >= 2 && res.length > 0 && (
          <View style={styles.resultsCount}>
            <Text style={styles.searchInfo}>
              {res.length} result{res.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        )}

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
          <View style={styles.resultsContainer}>
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
          </View>
        )}
      </View>
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
    backgroundColor: colors.primaryDark,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF20',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF20',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  headerSpacer: {
    width: 40,
  },
  resultsCount: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  searchInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
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