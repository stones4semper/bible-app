import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOOKS } from '../lib/books';
import { colors } from '../utils/colors';

const { width } = Dimensions.get('window');

const getBooksCount = () => Promise.resolve(66);

export default function BooksScreen({ navigation }) {
  const [count, setCount] = useState(66);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const headerSlideAnim = useState(new Animated.Value(-100))[0];
  const itemsSlideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    (async () => {
      try {
        const c = await getBooksCount();
        setCount(c || 66);
      } catch {
        setCount(66);
      }
    })();
  }, []);

  useEffect(() => {
    // Staggered animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(itemsSlideAnim, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const data = useMemo(
    () => Array.from({ length: Math.min(count, BOOKS.length) }, (_, i) => ({ 
      id: i, 
      name: BOOKS[i],
      colorIndex: i % 5 // For consistent color groups
    })),
    [count]
  );

  const BookItem = React.memo(({ item, index, onPress }) => {
    const scaleValue = React.useRef(new Animated.Value(1)).current;
    const itemSlideAnim = React.useRef(new Animated.Value(50)).current;
    
    React.useEffect(() => {
      Animated.timing(itemSlideAnim, {
        toValue: 0,
        duration: 600,
        delay: index * 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, []);

    const onPressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.97,
        useNativeDriver: true,
      }).start();
    };
    
    const onPressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }).start();
    };

    const handlePress = () => {
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 0.95,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        })
      ]).start(() => {
        onPress();
      });
    };

    const getBookColor = (colorIndex) => {
      const colorSets = [
        colors.info, // Blue
        colors.error, // Red
        colors.success, // Green
        colors.warning, // Orange
        colors.accent, // Gold
      ];
      return colorSets[colorIndex];
    };

    const bookColor = getBookColor(item.colorIndex);

    return (
      
        <Animated.View 
          style={{ 
            transform: [
              { scale: scaleValue },
              { translateX: itemSlideAnim }
            ],
            opacity: fadeAnim
          }}
        >
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={handlePress}
            style={({ pressed }) => [
              styles.bookItem,
              { 
                backgroundColor: pressed ? colors.primaryLight + '15' : '#FFFFFF',
                borderLeftWidth: 4,
                borderLeftColor: bookColor
              }
            ]}
          >
            <View style={styles.bookContent}>
              <View style={styles.bookTextContainer}>
                <Text style={styles.bookName}>{item.name}</Text>
                <Text style={styles.bookNumber}>{index + 1} Chapters</Text>
              </View>
              <View style={[styles.bookIcon, { backgroundColor: bookColor + '20' }]}>
                <Text style={[styles.bookIconText, { color: bookColor }]}>📖</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
    );
  });

  const renderItem = ({ item, index }) => (
    <BookItem 
      item={item} 
      index={index} 
      onPress={() => navigation.navigate('Chapters', { book: item.id })}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
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
          <View>
            <Text style={styles.headerTitle}>Sacred Texts</Text>
            <Text style={styles.headerSubtitle}>Select a Book to Explore</Text>
          </View>
          <Pressable 
            onPress={() => navigation.navigate('Search')}
            style={({ pressed }) => [
              styles.searchButton,
              { backgroundColor: pressed ? '#FFFFFF20' : '#FFFFFF10' }
            ]}
          >
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchText}>Search</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.booksCount}>{data.length} Books Available</Text>
        
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingTop: 50,
    paddingHorizontal: 20,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  searchText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  booksCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    marginLeft: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  bookItem: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    shadowColor: colors.textTertiary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  bookContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  bookTextContainer: {
    flex: 1,
  },
  bookName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bookNumber: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  bookIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookIconText: {
    fontSize: 20,
  },
  separator: {
    height: 12,
  },
});