// lib/db.js
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';

let db = null;
const DB_NAME = 'holybible.db';

async function ensureDb() {
  if (db) return db;

  const sqliteDir = FileSystem.documentDirectory + 'SQLite';
  const destPath = `${sqliteDir}/${DB_NAME}`;

  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true }).catch(() => {});

  const destInfo = await FileSystem.getInfoAsync(destPath);
  if (!destInfo.exists) {
    const asset = Asset.fromModule(require('../../assets/holybible.db'));
    await asset.downloadAsync();
    const src = asset.localUri ?? asset.uri;
    await FileSystem.copyAsync({ from: src, to: destPath });
  }

  db = await SQLite.openDatabaseAsync(DB_NAME);
  return db;
}

export async function getDb() {
  return ensureDb();
}
