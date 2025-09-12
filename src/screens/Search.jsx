import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '../utils/colors';
import { searchVerses } from '../lib/queries';
import { BOOKS } from '../lib/books';
export default function SearchScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const debouncedQ = useDebounce(q.trim(), 300);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

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
        if (!cancelled) setRes(rows ?? []);
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

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search (min 2 chars)…"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => setQ(q)}
          clearButtonMode="while-editing"
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8 }}
        />
      </View>

      {err && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <Text style={{ color: 'tomato' }}>Search failed. Try again.</Text>
        </View>
      )}

      {loading && res.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={res}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('Verses', { book: item.Book, chapter: item.Chapter })}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: '#eee',
              }}
            >
              <Text style={{ fontSize: 12, color: '#666' }}>
                {BOOKS[item.Book]} {item.Chapter}:{item.Versecount}
              </Text>
              <Highlighted text={item.verse} query={debouncedQ} />
            </Pressable>
          )}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListEmptyComponent={
            debouncedQ.length >= 2 && !loading ? (
              <View style={{ padding: 16 }}>
                <Text>No results found.</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
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
  if (!query) return <Text style={{ fontSize: 15 }}>{content}</Text>;
  try {
    const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${esc})`, 'ig');
    const parts = content.split(re);
    return (
      <Text style={{ fontSize: 15 }}>
        {parts.map((p, i) =>
          re.test(p) ? (
            <Text key={i} style={{ fontWeight: '700' }}>
              {p}
            </Text>
          ) : (
            <Text key={i}>{p}</Text>
          )
        )}
      </Text>
    );
  } catch {
    return <Text style={{ fontSize: 15 }}>{content}</Text>;
  }
}
