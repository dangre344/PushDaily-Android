// WorkoutDB.js
import * as SQLite from "expo-sqlite";
import { Logger } from "../constants/Logger";

let db = null;

export const initDB = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync("workouts.db");
  }

  Logger.log("Database initialized:", db);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workoutId TEXT,
      name TEXT,
      calories TEXT,
      level TEXT,
      bodyPart TEXT,
      dateTime TEXT
    );
  `);

  return db;
};

export const getDB = () => {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
};

export const insertWorkout = async (workout) => {
  const { workoutId, name, calories, level, bodyPart } = workout;
  const dateTime = new Date().toISOString();
  const database = getDB();

  await database.runAsync(
    `INSERT INTO workouts (workoutId, name, calories, level, bodyPart, dateTime)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workoutId, name, calories, level, bodyPart, dateTime],
  );
};

export const insertMultipleWorkouts = async (workouts) => {
  const database = getDB();

  Logger.log("Inserting multiple workouts into database:", database);

  await database.withTransactionAsync(async () => {
    for (const workout of workouts) {
      const { workoutId, name, calories, level, bodyPart } = workout;
      const dateTime = new Date().toISOString();
      await database.runAsync(
        `INSERT INTO workouts (workoutId, name, calories, level, bodyPart, dateTime)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [workoutId, name, calories, level, bodyPart, dateTime],
      );
    }
  });
};

export const getAllWorkouts = async () => {
  const database = getDB();
  return await database.getAllAsync(
    `SELECT * FROM workouts ORDER BY dateTime DESC`,
  );
};

export const getAllWorkoutsBydate = async (dateKey = null) => {
  const database = getDB();

  Logger.log("Fetching workouts for dateKey:", dateKey);

  if (!dateKey) return [];

  // strftime('%Y-%m-%d', dateTime) safely strips time from any ISO format
  return await database.getAllAsync(
    `SELECT * FROM workouts 
     WHERE strftime('%Y-%m-%d', dateTime) = ? 
     ORDER BY dateTime DESC`,
    [dateKey], // "2026-03-12" — matches directly
  );
};

export const getTotalCalories = async () => {
  const database = getDB();

  const result = await database.getFirstAsync(
    `SELECT SUM(CAST(REPLACE(calories, 'undefined', '') AS INTEGER)) as total 
     FROM workouts`,
  );

  return result?.total ?? 0;
};

export const getAllWorkoutDates = async () => {
  const database = getDB();

  const result = await database.getAllAsync(
    `SELECT DISTINCT strftime('%Y-%m-%d', dateTime, 'localtime') as dateKey
     FROM workouts
     ORDER BY dateKey DESC`,
  );

  return result.map((r) => r.dateKey); // ["2026-03-13", "2026-03-12", ...]
};

// WorkoutDB.js
export const getWorkoutsForCurrentWeek = async () => {
  const database = getDB();

  // Get Sunday of current week
  const today = new Date();
  const day = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  sunday.setHours(0, 0, 0, 0);

  // Saturday = Sunday + 6 days, end of day
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  const startKey = sunday.toISOString().slice(0, 10); // "2026-03-08"
  const endKey = saturday.toISOString().slice(0, 10); // "2026-03-14"

  Logger.log("getWorkoutsForCurrentWeek range", { startKey, endKey });

  return await database.getAllAsync(
    `SELECT * FROM workouts
     WHERE strftime('%Y-%m-%d', dateTime) BETWEEN ? AND ?
     ORDER BY dateTime ASC`,
    [startKey, endKey],
  );
};

export const deleteWorkout = async (id) => {
  const database = getDB();
  await database.runAsync(`DELETE FROM workouts WHERE id = ?`, [id]);
};

export const clearWorkouts = async () => {
  const database = getDB();
  await database.runAsync(`DELETE FROM workouts`);
};

export const getProfileStats = async () => {
  const database = getDB();

  // Total workouts count
  const workoutsResult = await database.getFirstAsync(
    `SELECT COUNT(*) as total FROM workouts`,
  );

  // Total calories (strip corrupted "undefined" strings)
  const caloriesResult = await database.getFirstAsync(
    `SELECT SUM(CAST(REPLACE(calories, 'undefined', '') AS INTEGER)) as total
     FROM workouts`,
  );

  // Active days = distinct dates that have at least one workout
  const activeDaysResult = await database.getFirstAsync(
    `SELECT COUNT(DISTINCT strftime('%Y-%m-%d', dateTime, 'localtime')) as total
     FROM workouts`,
  );

  return {
    totalWorkouts: workoutsResult?.total ?? 0,
    totalCalories: caloriesResult?.total ?? 0,
    activeDays: activeDaysResult?.total ?? 0,
  };
};

export const getCurrentStreak = async () => {
  const database = getDB();

  // Get all distinct workout dates in descending order
  const result = await database.getAllAsync(
    `SELECT DISTINCT strftime('%Y-%m-%d', dateTime, 'localtime') as dateKey
     FROM workouts
     ORDER BY dateKey DESC`,
  );

  if (!result || result.length === 0) return 0;

  const dates = result.map((r) => r.dateKey);

  // Helper to get local date key from a Date object
  const toLocalKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const todayKey = toLocalKey(new Date());
  const yesterdayKey = toLocalKey(new Date(Date.now() - 86400000));

  // Streak only counts if worked out today OR yesterday (grace period)
  if (dates[0] !== todayKey && dates[0] !== yesterdayKey) return 0;

  let streak = 0;
  let cursor = new Date();

  // If most recent date is yesterday, start counting from yesterday
  if (dates[0] === yesterdayKey) {
    cursor = new Date(Date.now() - 86400000);
  }

  for (let i = 0; i < dates.length; i++) {
    const expected = toLocalKey(cursor);
    if (dates[i] === expected) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000); // go back 1 day
    } else {
      break; // gap found, streak ends
    }
  }

  return streak;
};
