// lib/queries.js
import { getDb } from './db';

// Escape %, _ and \ for SQL LIKE with ESCAPE '\'
function escapeLike(s) {
  return String(s).replace(/([%_\\])/g, '\\$1');
}

export async function getBooksCount() {
  const db = await getDb();
  // DB is 0-based (0..65). MAX(Book)+1 = 66. COUNT(DISTINCT Book) is also fine.
  const rows = await db.getAllAsync('SELECT MAX(Book)+1 AS c FROM bible');
  return rows?.[0]?.c ?? 66;
}

export async function getBookMaxChapter(book) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT MAX(Chapter) AS c FROM bible WHERE Book = ?',
    [book]
  );
  return rows?.[0]?.c ?? 0;
}

export async function getVerses(book, chapter) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT Book, Chapter, Versecount, verse FROM bible WHERE Book = ? AND Chapter = ? ORDER BY Versecount',
    [book, chapter]
  );
  return rows;
}

export async function searchVerses(q, { limit = 200, offset = 0 } = {}) {
  const db = await getDb();
  const needle = `%${escapeLike(q)}%`;
  const rows = await db.getAllAsync(
    `SELECT Book, Chapter, Versecount, verse
     FROM bible
     WHERE verse LIKE ? ESCAPE '\\'
     LIMIT ? OFFSET ?`,
    [needle, limit, offset]
  );
  return rows;
}
