// offlinedb/SQLiteProvider.js
import { createContext, useContext, useEffect, useState } from "react";
import { getAllWorkouts, initDB } from "./workoutdb";

const SQLiteContext = createContext();

export const SQLiteProvider = ({ children }) => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupDB = async () => {
      try {
        await initDB(); // Initialize DB
        const allWorkouts = await getAllWorkouts(); // Load existing workouts
        setWorkouts(allWorkouts);
      } catch (e) {
        console.log("DB setup error:", e);
      } finally {
        setLoading(false);
      }
    };

    setupDB();
  }, []);

  return (
    <SQLiteContext.Provider value={{ workouts, setWorkouts, loading }}>
      {children}
    </SQLiteContext.Provider>
  );
};

// Hook to use in components
export const useSQLite = () => useContext(SQLiteContext);
