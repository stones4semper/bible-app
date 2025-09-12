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
  SafeAreaView 
} from 'react-native';
import { colors } from '../utils/colors';
import { getVerses, getBookMaxChapter, getBooksCount } from '../lib/queries';
import { BOOKS } from '../lib/books';
import { Ionicons } from '@expo/vector-icons'; // Or use text icons if unavailable

const { width } = Dimensions.get('window');

export default function VersesScreen({ navigation, route }) {
  const b = useMemo(() => Number(route.params.book), [route.params.book]);       // 0-based
  const c = useMemo(() => Number(route.params.chapter), [route.params.chapter]); // 1..N

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [booksCount, setBooksCount] = useState(null);
  const [maxChapter, setMaxChapter] = useState(null);
  const [prevTarget, setPrevTarget] = useState(null); // { book, chapter } or null
  const [nextTarget, setNextTarget] = useState(null); // { book, chapter } or null
  const [navBusy, setNavBusy] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const footerSlideAnim = useRef(new Animated.Value(100)).current;

  // Load verses for current (book, chapter)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await getVerses(b, c);
        if (!cancelled) {
          setData(rows ?? []);
          
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
            Animated.timing(footerSlideAnim, {
              toValue: 0,
              duration: 700,
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
    })();
    return () => { cancelled = true; };
  }, [b, c]);

  // Compute maxChapter for this book + total books once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mc, bc] = await Promise.all([
          getBookMaxChapter(b),
          booksCount == null ? getBooksCount() : Promise.resolve(booksCount),
        ]);
        if (cancelled) return;
        setMaxChapter(mc ?? 0);
        setBooksCount(bc ?? 66);
      } catch {
        // ignore; UI will degrade gracefully
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b]);

  // Compute prev/next targets whenever (b,c,maxChapter,booksCount) change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (booksCount == null || maxChapter == null) return;

      // Prev
      let prev = null;
      if (c > 1) {
        prev = { book: b, chapter: c - 1 };
      } else if (b > 0) {
        const lastOfPrev = await getBookMaxChapter(b - 1);
        if (cancelled) return;
        if (lastOfPrev && lastOfPrev > 0) prev = { book: b - 1, chapter: lastOfPrev };
      }

      // Next
      let next = null;
      if (maxChapter && c < maxChapter) {
        next = { book: b, chapter: c + 1 };
      } else if (booksCount && b < booksCount - 1) {
        next = { book: b + 1, chapter: 1 };
      }

      if (!cancelled) {
        setPrevTarget(prev);
        setNextTarget(next);
      }
    })();
    return () => { cancelled = true; };
  }, [b, c, maxChapter, booksCount]);

  const goTo = (target) => {
    if (!target || navBusy) return;
    setNavBusy(true);
    
    // Reset animations before navigating
    fadeAnim.setValue(0);
    headerSlideAnim.setValue(-50);
    footerSlideAnim.setValue(100);
    
    // push a new Verses screen with next params
    navigation.navigate('Verses', { book: target.book, chapter: target.chapter });
    // allow quick subsequent taps; RN nav will remount/useEffect anyway
    setTimeout(() => setNavBusy(false), 50);
  };

  const VerseItem = ({ item, index }) => {
    const verseScale = useRef(new Animated.Value(0.9)).current;
    
    useEffect(() => {
      Animated.spring(verseScale, {
        toValue: 1,
        delay: index * 30,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View 
        style={[
          styles.verseItem,
          { 
            transform: [{ scale: verseScale }],
            opacity: fadeAnim 
          }
        ]}
      >
        <View style={styles.verseNumber}>
          <Text style={styles.verseNumberText}>{item.Versecount}</Text>
        </View>
        <Text style={styles.verseText}>
          {item.verse}
        </Text>
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
        <Text style={styles.errorTitle}>{BOOKS[b]} {c}</Text>
        <Text style={styles.errorText}>Failed to load verses.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: headerSlideAnim }] 
          }
        ]}
      >
        <View style={styles.headerContent}>
          <Text style={styles.bookTitle}>{BOOKS[b]}</Text>
          <Text style={styles.chapterTitle}>Chapter {c}</Text>
          {maxChapter ? (
            <Text style={styles.chapterProgress}>
              {c} of {maxChapter}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      {/* Verses */}
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.Versecount)}
        renderItem={({ item, index }) => <VerseItem item={item} index={index} />}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        getItemLayout={(_, index) => ({
          length: 80,
          offset: 80 * index,
          index,
        })}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Next/Prev footer */}
      <Animated.View
        style={[
          styles.footer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: footerSlideAnim }] 
          }
        ]}
      >
        <View style={styles.navButtons}>
          <NavButton
            direction="prev"
            label={
              prevTarget
                ? `${BOOKS[prevTarget.book]} ${prevTarget.chapter}`
                : 'Previous'
            }
            disabled={!prevTarget || navBusy}
            onPress={() => goTo(prevTarget)}
          />
          
          <View style={styles.currentIndicator}>
            <Text style={styles.currentText}>
              {BOOKS[b]} {c}
            </Text>
          </View>
          
          <NavButton
            direction="next"
            label={
              nextTarget
                ? `${BOOKS[nextTarget.book]} ${nextTarget.chapter}`
                : 'Next'
            }
            disabled={!nextTarget || navBusy}
            onPress={() => goTo(nextTarget)}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function NavButton({ direction, label, disabled, onPress }) {
  const scaleValue = useRef(new Animated.Value(1)).current;
  
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

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <Pressable
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={[styles.navButton, disabled && styles.navButtonDisabled]}
      >
        {direction === 'prev' && (
          <Text style={styles.navIcon}>◀</Text>
        )}
        <Text 
          style={[styles.navButtonText, disabled && styles.navButtonTextDisabled]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
        {direction === 'next' && (
          <Text style={styles.navIcon}>▶</Text>
        )}
      </Pressable>
    </Animated.View>
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
  errorContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  headerContent: {
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  chapterProgress: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for footer
  },
  verseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  verseNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  verseNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  verseText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 80,
  },
  navButtonDisabled: {
    backgroundColor: colors.textTertiary + '40',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginHorizontal: 4,
    maxWidth: 100,
  },
  navButtonTextDisabled: {
    color: colors.textTertiary,
  },
  navIcon: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  currentIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  currentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});