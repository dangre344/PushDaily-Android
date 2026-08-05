import * as SQLite from "expo-sqlite";
import { Logger } from "../constants/Logger";

// Local persistence for the trainer chat (Android + iOS via expo-sqlite),
// separate from the workouts DB.
let db = null;
let dbInitPromise = null;

export const initChatDB = async () => {
  if (db) return db;

  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const opened = await SQLite.openDatabaseAsync("chat.db");
      await opened.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          role TEXT,
          text TEXT,
          time TEXT,
          createdAt INTEGER
        );
      `);
      db = opened;
      return db;
    })();
  }

  return dbInitPromise;
};

// Insert or update a single message (finalized text only — never a streaming stub).
export const saveChatMessage = async (m) => {
  if (!m || !m.id || m.streaming) return;
  try {
    const database = await initChatDB();
    await database.runAsync(
      `INSERT OR REPLACE INTO chat_messages (id, role, text, time, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(m.id),
        m.role || "trainer",
        String(m.text || ""),
        String(m.time || ""),
        m.createdAt || Date.now(),
      ],
    );
  } catch (e) {
    Logger.log("[ChatDB] save failed:", String(e));
  }
};

// Returns messages NEWEST-FIRST to match the inverted FlatList in the chat UI.
export const getChatMessages = async (limit = 300) => {
  try {
    const database = await initChatDB();
    const rows = await database.getAllAsync(
      `SELECT id, role, text, time FROM chat_messages
       ORDER BY createdAt DESC LIMIT ?`,
      [limit],
    );
    return rows || [];
  } catch (e) {
    Logger.log("[ChatDB] load failed:", String(e));
    return [];
  }
};

export const clearChatMessages = async () => {
  try {
    const database = await initChatDB();
    await database.runAsync(`DELETE FROM chat_messages`);
  } catch (e) {
    Logger.log("[ChatDB] clear failed:", String(e));
  }
};
