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
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Speech from 'expo-speech';
import { colors as themeColors } from '../utils/colors';
import { getVerses, getBookMaxChapter, getBooksCount } from '../lib/queries';
import { BOOKS } from '../lib/books';

export default function VersesScreen({ navigation, route }) {
  const b = useMemo(() => Number(route.params.book), [route.params.book]);
  const c = useMemo(() => Number(route.params.chapter), [route.params.chapter]);
  const v = useMemo(
    () => (route.params.verse != null ? Number(route.params.verse) : undefined),
    [route.params.verse]
  );

  const insets = useSafeAreaInsets();
  const colors = themeColors;
  const HIGHLIGHT = colors.highlight ?? '#FFF7D6';
  const HIGHLIGHT_PULSE = colors.highlightPulse ?? '#FFF1B3';

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [booksCount, setBooksCount] = useState(null);
  const [maxChapter, setMaxChapter] = useState(null);
  const [prevTarget, setPrevTarget] = useState(null);
  const [nextTarget, setNextTarget] = useState(null);
  const [navBusy, setNavBusy] = useState(false);

  // Speech state
  const [isReading, setIsReading] = useState(false);
  const [currentReadIndex, setCurrentReadIndex] = useState(-1);
  const speechCancelledRef = useRef(false);

  // Header/List animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-40)).current;

  // FAB speed-dial animation
  const fabOpen = useRef(new Animated.Value(0)).current; // 0 closed, 1 open

  // List ref
  const listRef = useRef(null);

  // Fetch verses
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await getVerses(b, c);
        if (!cancelled) {
          setData(rows ?? []);
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(headerSlideAnim, {
              toValue: 0,
              duration: 450,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start();
        }
      } catch (e) {
        if (!cancelled) setErr(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [b, c]);

  // Auto-scroll to initial verse param
  useEffect(() => {
    if (!v || !data?.length || !listRef.current) return;
    const index = data.findIndex((row) => Number(row.Versecount) === Number(v));
    if (index < 0) return;
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.25 });
    }, 120);
    return () => clearTimeout(id);
  }, [data, v]);

  // Book meta
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mc, bc] = await Promise.all([
          getBookMaxChapter(b),
          booksCount == null ? getBooksCount() : Promise.resolve(booksCount),
        ]);
        if (!cancelled) {
          setMaxChapter(mc ?? 0);
          setBooksCount(bc ?? 66);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [b]);

  // Prev/Next targets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (booksCount == null || maxChapter == null) return;

      let prev = null;
      if (c > 1) prev = { book: b, chapter: c - 1 };
      else if (b > 0) {
        const lastOfPrev = await getBookMaxChapter(b - 1);
        if (cancelled) return;
        if (lastOfPrev > 0) prev = { book: b - 1, chapter: lastOfPrev };
      }

      let next = null;
      if (c < maxChapter) next = { book: b, chapter: c + 1 };
      else if (b < booksCount - 1) next = { book: b + 1, chapter: 1 };

      if (!cancelled) { setPrevTarget(prev); setNextTarget(next); }
    })();
    return () => { cancelled = true; };
  }, [b, c, maxChapter, booksCount]);

  const goToChapter = (target) => {
    if (!target || navBusy) return;
    stopReading();
    setNavBusy(true);
    fadeAnim.setValue(0);
    headerSlideAnim.setValue(-40);
    navigation.navigate('Verses', { book: target.book, chapter: target.chapter, verse: undefined });
    setTimeout(() => setNavBusy(false), 60);
  };

  // ---------- Speech (expo-speech) ----------
  useEffect(() => () => { speechCancelledRef.current = true; Speech.stop(); }, []);

  const speakOne = async (i) => {
    if (!data || i < 0 || i >= data.length) return 'invalid';
    const text = String(data[i]?.verse ?? '').trim();
    if (!text) return 'empty';
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.5,
        pitch: 1.0,
        onDone: () => resolve('done'),
        onStopped: () => resolve('stopped'),
        onError: () => resolve('error'),
      });
    });
  };

  const playFromIndex = async (start) => {
    if (!data?.length) return;
    let i = Math.max(0, Math.min(start, data.length - 1));
    speechCancelledRef.current = false;
    setIsReading(true);
    setCurrentReadIndex(i);

    while (!speechCancelledRef.current && i < data.length) {
      // eslint-disable-next-line no-await-in-loop
      const r = await speakOne(i);
      if (speechCancelledRef.current) break;
      if (r === 'stopped' || r === 'error' || r === 'invalid') break;
      i += 1;
      setCurrentReadIndex(i);
    }
    if (!speechCancelledRef.current) { setIsReading(false); setCurrentReadIndex(-1); }
  };

  const play = () => {
    if (!data?.length) return;
    if (currentReadIndex === -1) {
      if (v != null) {
        const idx = data.findIndex((row) => Number(row.Versecount) === Number(v));
        playFromIndex(idx >= 0 ? idx : 0);
      } else {
        playFromIndex(0);
      }
    } else {
      playFromIndex(currentReadIndex);
    }
  };

  const pause = () => {
    speechCancelledRef.current = true;
    Speech.stop();
    setIsReading(false);
  };

  const stopReading = () => {
    speechCancelledRef.current = true;
    Speech.stop();
    setIsReading(false);
    setCurrentReadIndex(-1);
  };

  const nextVerse = () => {
    if (!data?.length) return;
    const nextIdx = Math.min(currentReadIndex === -1 ? 0 : currentReadIndex + 1, data.length - 1);
    stopReading(); playFromIndex(nextIdx);
  };

  const prevVerse = () => {
    if (!data?.length) return;
    const prevIdx = Math.max(currentReadIndex === -1 ? 0 : currentReadIndex - 1, 0);
    stopReading(); playFromIndex(prevIdx);
  };

  // Auto-scroll while reading
  useEffect(() => {
    if (currentReadIndex < 0 || !listRef.current) return;
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: currentReadIndex, animated: true, viewPosition: 0.25 });
    }, 60);
    return () => clearTimeout(id);
  }, [currentReadIndex]);

  // FAB: toggle open/close
  const toggleFab = () => {
    Animated.spring(fabOpen, {
      toValue: (fabOpen)._value ? 0 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
  };

  // Derived transforms for actions (translateY up & fade in)
  const act1Style = {
    transform: [
      { translateY: fabOpen.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) },
      { scale: fabOpen.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
    ],
    opacity: fabOpen,
  };
  const act2Style = {
    transform: [
      { translateY: fabOpen.interpolate({ inputRange: [0, 1], outputRange: [0, -130] }) },
      { scale: fabOpen.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
    ],
    opacity: fabOpen,
  };

  const VerseItem = ({ item, index, isSelected }) => {
    // OUTER (native transform)
    const verseScale = useRef(new Animated.Value(0.98)).current;
    const verseSlide = useRef(new Animated.Value(14)).current;
    // INNER (JS bg pulse)
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(verseScale, { toValue: 1, delay: index * 18, friction: 7, tension: 40, useNativeDriver: true }),
        Animated.timing(verseSlide, { toValue: 0, duration: 360, delay: index * 18, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();

      if (isSelected) {
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 240, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 520, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 1, duration: 240, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 520, useNativeDriver: false }),
        ]).start();
      }
    }, [isSelected]);

    const bg = pulse.interpolate({ inputRange: [0, 1], outputRange: [HIGHLIGHT, HIGHLIGHT_PULSE] });

    return (
      <Animated.View style={{ transform: [{ scale: verseScale }, { translateY: verseSlide }], opacity: fadeAnim }}>
        <Animated.View
          style={[
            styles.verseCard,
            isSelected && { backgroundColor: bg, borderColor: colors.primary, borderWidth: 1 },
          ]}
        >
          <View style={[styles.badge, isSelected && { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, isSelected && { color: '#fff' }]}>{item.Versecount}</Text>
          </View>
          <Text style={[styles.verseBody, isSelected && { color: colors.primaryDark }]}>{item.verse}</Text>
        </Animated.View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading {BOOKS[b]} {c}...</Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={48} color={colors.error} style={{ marginBottom: 12 }} />
        <Text style={styles.errorTitle}>{BOOKS[b]} {c}</Text>
        <Text style={styles.errorText}>Failed to load verses. Please try again.</Text>
        <Pressable style={styles.retryButton} onPress={() => navigation.replace('Verses', { book: b, chapter: c, verse: v })}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // bottom padding now only needs to clear the FAB tap area a bit
  const bottomPad = (insets.bottom || 0) + 24;

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar style="light" backgroundColor={colors.primary} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* HEADER */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={[styles.headerGrad, { paddingTop: insets.top + 8 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: headerSlideAnim }] }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.headBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>

            {/* Title + inline chapter nav */}
            <View style={styles.headerTitleWrap}>
              <Pressable
                disabled={!prevTarget}
                onPress={() => goToChapter(prevTarget)}
                style={({ pressed }) => [styles.inlineNavBtn, !prevTarget && { opacity: 0.4 }, { opacity: pressed ? 0.6 : 1 }]}
                accessibilityLabel="Previous chapter"
              >
                <Ionicons name="chevron-back" size={18} color="#fff" />
              </Pressable>

              <View style={{ alignItems: 'center', minWidth: 140 }}>
                <Text style={styles.headerTitle}>{BOOKS[b]}</Text>
                <Text style={styles.headerSubtitle}>
                  Chapter {c}{maxChapter ? ` · ${c} / ${maxChapter}` : ''}
                </Text>
              </View>

              <Pressable
                disabled={!nextTarget}
                onPress={() => goToChapter(nextTarget)}
                style={({ pressed }) => [styles.inlineNavBtn, !nextTarget && { opacity: 0.4 }, { opacity: pressed ? 0.6 : 1 }]}
                accessibilityLabel="Next chapter"
              >
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </Pressable>
            </View>

            {/* Quick stop in header (optional): */}
            <Pressable onPress={stopReading} style={styles.headBtn} accessibilityLabel="Stop reading">
              <Ionicons name="stop" size={18} color="#fff" />
            </Pressable>
          </Animated.View>
        </LinearGradient>

        {/* LIST */}
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item) => String(item.Versecount)}
          renderItem={({ item, index }) => (
            <VerseItem
              item={item}
              index={index}
              isSelected={Number(item.Versecount) === Number(v) || index === currentReadIndex}
            />
          )}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            const approx = Math.max(0, info.averageItemLength * (info.index - 3));
            listRef.current?.scrollToOffset({ offset: approx, animated: false });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.25 });
            }, 60);
          }}
        />

        {/* FAB + Speed Dial */}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View
            style={[
              styles.fabArea,
              { bottom: Math.max(insets.bottom, 16), right: Math.max(insets.right ?? 16, 16) },
            ]}
            pointerEvents="box-none"
          >
            {/* Action 2: Next */}
            <Animated.View style={[styles.fabAction, act1Style]}>
              <Pressable
                onPress={() => { toggleFab(); nextVerse(); }}
                style={styles.fabActionBtn}
                accessibilityLabel="Next verse"
              >
                <Ionicons name="play-skip-forward" size={18} color="#fff" />
              </Pressable>
            </Animated.View>

            {/* Action 1: Prev */}
            <Animated.View style={[styles.fabAction, act2Style]}>
              <Pressable
                onPress={() => { toggleFab(); prevVerse(); }}
                style={styles.fabActionBtn}
                accessibilityLabel="Previous verse"
              >
                <Ionicons name="play-skip-back" size={18} color="#fff" />
              </Pressable>
            </Animated.View>

            {/* Main FAB */}
            <Pressable
              onPress={() => { if (isReading) pause(); else play(); }}
              onLongPress={stopReading}
              style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={isReading ? 'Pause (long press to stop)' : 'Play (long press to stop)'}
            >
              <Ionicons name={isReading ? 'pause' : 'play'} size={24} color="#fff" />
            </Pressable>

            {/* Speed-dial toggle */}
            <Pressable
              onPress={toggleFab}
              style={({ pressed }) => [styles.fabSmall, { opacity: pressed ? 0.85 : 1 }]}
              accessibilityLabel="More player actions"
            >
              <Ionicons name="options" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */

const colors = themeColors;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primaryDark },

  // Header
  headerGrad: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFFFFF20', alignItems: 'center', justifyContent: 'center',
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineNavBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FFFFFF25', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#fff', opacity: 0.9, fontSize: 12, marginTop: 2 },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 18 },

  verseCard: {
    flexDirection: 'row', gap: 14,
    paddingVertical: 16, paddingHorizontal: 14, marginBottom: 12,
    borderRadius: 14, backgroundColor: colors.surface,
    shadowColor: colors.textTertiary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  badge: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  verseBody: { flex: 1, color: colors.textPrimary, fontSize: 17, lineHeight: 26 },

  // Loading / Error
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.textSecondary },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  errorTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  errorText: { color: colors.textSecondary, marginBottom: 18 },
  retryButton: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },

  // FAB cluster
  fabArea: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    alignItems: 'flex-end',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 10 },
    }),
  },
  fabSmall: {
    marginTop: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  fabAction: {
    position: 'absolute',
    right: 12,
    bottom: 80, // base anchor under main FAB
  },
  fabActionBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
});
