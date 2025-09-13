import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { StatusBar } from 'expo-status-bar';
import { searchVerses } from '../lib/queries';
import { BOOKS } from '../lib/books';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function SearchScreen({ navigation }) {
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q.trim(), 300);

  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const loadingMoreRef = useRef(false); // throttle `onEndReached`

  // Animations (mount only)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!hasAnimated.current) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(headerSlideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
      hasAnimated.current = true;
    }
  }, []);

  // Run search when debounced query changes
  useEffect(() => {
    let cancelled = false;
    setPage(0);

    const run = async () => {
      if (debouncedQ.length < 2) {
        setRes([]);
        setHasMore(false);
        setLoading(false);
        setErr(null);
        return;
      }
      try {
        setLoading(true);
        setErr(null);
        const rows = await searchVerses(debouncedQ, { limit: PAGE_SIZE, offset: 0 });
        if (cancelled) return;
        setRes(rows ?? []);
        setHasMore((rows?.length ?? 0) === PAGE_SIZE); // if we got a full page, more likely exists
      } catch (e) {
        if (!cancelled) setErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  // Robust loadMore (guarded + throttled)
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    if (!hasMore) return;                // nothing more to load
    if (loading) return;                 // initial load still running
    if (res.length < PAGE_SIZE) return;  // short list: avoid storm

    loadingMoreRef.current = true;
    try {
      const nextPage = page + 1;
      const more = await searchVerses(debouncedQ, {
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      });
      if (more?.length) {
        setRes((prev) => [...prev, ...more]);
        setPage(nextPage);
        setHasMore(more.length === PAGE_SIZE); // only keep true if exactly a full page
      } else {
        setHasMore(false);
      }
    } catch {
      // keep hasMore as-is; user can retry by scrolling again
    } finally {
      // a small timeout prevents immediate re-entry due to content size changes
      setTimeout(() => {
        loadingMoreRef.current = false;
      }, 150);
    }
  }, [debouncedQ, hasMore, loading, page, res.length]);

  const keyExtractor = useCallback(
    (item) => `${item.Book}-${item.Chapter}-${item.Versecount}`,
    []
  );

  const handlePressResult = useCallback(
    (item) => {
      navigation.navigate('Verses', {
        book: item.Book,
        chapter: item.Chapter,
        verse: item.Versecount,
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => handlePressResult(item)}
        style={({ pressed }) => [
          styles.resultItem,
          { backgroundColor: pressed ? colors.primaryLight + '10' : colors.surface },
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
    ),
    [debouncedQ, handlePressResult]
  );

  // Only attach onEndReached when it makes sense
  const listOnEndReached = useMemo(() => {
    if (!hasMore) return undefined;
    if (res.length < PAGE_SIZE) return undefined; // short lists would trigger immediately
    return loadMore;
  }, [hasMore, res.length, loadMore]);

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar style="light" backgroundColor={colors.primary} />
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
                transform: [{ translateY: headerSlideAnim }],
              },
            ]}
          >
            {/* Back */}
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>

            {/* Search */}
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
              renderItem={renderItem}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={10}
              // Removing removeClippedSubviews when list is short avoids visual glitches on Android
              // removeClippedSubviews
              onEndReachedThreshold={0.3}
              onEndReached={listOnEndReached}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
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
                hasMore && res.length > 0 ? (
                  <View style={styles.footerLoading}>
                    {loadingMoreRef.current ? (
                      <>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.footerLoadingText}>Loading more results...</Text>
                      </>
                    ) : null}
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
  const content = String(text ?? '');
  if (!query) return <Text style={styles.verseText}>{content}</Text>;

  // Safe, non-stateful highlight (no /g .test side effects)
  const qLower = query.toLowerCase();
  const parts = content.split(new RegExp(`(${escapeRegExp(query)})`, 'i')); // first match split
  // If you want to highlight ALL occurrences reliably, do a manual scan:
  const tokens = [];
  let i = 0;
  const re = new RegExp(escapeRegExp(query), 'ig');
  let lastIndex = 0;
  for (let m = re.exec(content); m; m = re.exec(content)) {
    if (m.index > lastIndex) tokens.push({ t: content.slice(lastIndex, m.index), h: false, k: i++ });
    tokens.push({ t: content.substr(m.index, m[0].length), h: true, k: i++ });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) tokens.push({ t: content.slice(lastIndex), h: false, k: i++ });

  if (tokens.length === 0) return <Text style={styles.verseText}>{content}</Text>;

  return (
    <Text style={styles.verseText}>
      {tokens.map((p) =>
        p.h ? (
          <Text key={p.k} style={styles.highlightedText}>{p.t}</Text>
        ) : (
          <Text key={p.k}>{p.t}</Text>
        )
      )}
    </Text>
  );
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark },
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#FFFFFF', paddingVertical: 0 },
  headerSpacer: { width: 40 },

  resultsCount: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  searchInfo: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  errorText: { marginLeft: 8, color: colors.error, fontSize: 14 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 16, fontSize: 16, color: colors.textSecondary },

  resultsContainer: { flex: 1 },
  listContent: { padding: 16 },

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
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reference: { fontSize: 14, fontWeight: '600', color: colors.primary },
  verseText: { fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  highlightedText: { backgroundColor: colors.accent + '40', fontWeight: '700', color: colors.textPrimary },

  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  initialContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  initialTitle: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  initialText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  footerLoading: { padding: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  footerLoadingText: { marginLeft: 8, fontSize: 14, color: colors.textSecondary },
});
