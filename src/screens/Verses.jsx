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
  ScrollView
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../utils/colors';
import { getVerses, getBookMaxChapter, getBooksCount } from '../lib/queries';
import { BOOKS } from '../lib/books';

const { width } = Dimensions.get('window');

export default function VersesScreen({ navigation, route }) {
  const b = useMemo(() => Number(route.params.book), [route.params.book]);
  const c = useMemo(() => Number(route.params.chapter), [route.params.chapter]);
  const insets = useSafeAreaInsets();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [booksCount, setBooksCount] = useState(null);
  const [maxChapter, setMaxChapter] = useState(null);
  const [prevTarget, setPrevTarget] = useState(null);
  const [nextTarget, setNextTarget] = useState(null);
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
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(headerSlideAnim, {
              toValue: 0,
              duration: 600,
              easing: Easing.out(Easing.back(1.2)),
              useNativeDriver: true,
            }),
            Animated.timing(footerSlideAnim, {
              toValue: 0,
              duration: 800,
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
    
    navigation.navigate('Verses', { book: target.book, chapter: target.chapter });
    setTimeout(() => setNavBusy(false), 50);
  };

  const VerseItem = ({ item, index }) => {
    const verseScale = useRef(new Animated.Value(0.9)).current;
    const verseSlide = useRef(new Animated.Value(20)).current;
    
    useEffect(() => {
      Animated.parallel([
        Animated.spring(verseScale, {
          toValue: 1,
          delay: index * 40,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(verseSlide, {
          toValue: 0,
          duration: 500,
          delay: index * 40,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      ]).start();
    }, []);

    return (
      <Animated.View 
        style={[
          styles.verseItem,
          { 
            transform: [{ scale: verseScale }, { translateX: verseSlide }],
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
        <Ionicons name="warning" size={48} color={colors.error} style={styles.errorIcon} />
        <Text style={styles.errorTitle}>{BOOKS[b]} {c}</Text>
        <Text style={styles.errorText}>Failed to load verses. Please try again.</Text>
        <Pressable 
          style={styles.retryButton}
          onPress={() => navigation.replace('Verses', { book: b, chapter: c })}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
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
            <Text style={styles.chapterTitle}>Chapter {c}</Text>
            {maxChapter ? (
              <Text style={styles.chapterProgress}>
                {c} of {maxChapter}
              </Text>
            ) : null}
          </View>

          {/* Spacer for balance */}
          <View style={styles.headerSpacer} />
        </Animated.View>
      </LinearGradient>

      {/* Verses List */}
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.Versecount)}
        renderItem={({ item, index }) => <VerseItem item={item} index={index} />}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      />

      {/* Navigation Footer */}
      <Animated.View
        style={[
          styles.footer,
          { 
            paddingBottom: insets.bottom,
            opacity: fadeAnim,
            transform: [{ translateY: footerSlideAnim }] 
          }
        ]}
      >
        <View style={styles.navButtons}>
          <NavButton
            direction="prev"
            label={prevTarget ? `← ${BOOKS[prevTarget.book]} ${prevTarget.chapter}` : '← Previous'}
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
            label={nextTarget ? `${BOOKS[nextTarget.book]} ${nextTarget.chapter} →` : 'Next →'}
            disabled={!nextTarget || navBusy}
            onPress={() => goTo(nextTarget)}
          />
        </View>
      </Animated.View>
    </View>
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
    <Animated.View style={{ transform: [{ scale: scaleValue }]}}>
      <Pressable
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={[styles.navButton, disabled && styles.navButtonDisabled]}
      >
        <Text 
          style={[styles.navButtonText, disabled && styles.navButtonTextDisabled]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
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
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
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
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  bookTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  chapterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  chapterProgress: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    padding: 20,
    paddingTop: 24,
  },
  verseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: colors.textTertiary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  verseNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  verseNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  verseText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textPrimary,
    textAlign: 'justify',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 100,
  },
  navButtonDisabled: {
    backgroundColor: colors.textTertiary + '30',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: colors.textTertiary,
  },
  currentIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
  },
  currentText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});