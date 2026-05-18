import React, { createContext, useContext, useEffect, useState } from "react";
import { Logger } from "./Logger";
import { getSession, saveSession } from "./SessionManager";

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export default function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  Logger.log("user--UserProvider->", user);
  Logger.log("isUserLoaded--UserProvider->", isUserLoaded);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const session = await getSession();
        console.log("session--->", session);

        if (!mounted) return;

        if (session) {
          setUser(session);
        } else {
          setUser(null);
        }
      } catch (error) {
        Logger.log("loadSession error--->", error);

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsUserLoaded(true);
        }
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const updateUser = async (data) => {
    const updated = { ...(user || {}), ...data };

    setUser(updated);
    setIsUserLoaded(true);
    await saveSession(updated);

    return updated;
  };

  return (
    <UserContext.Provider value={{ user, updateUser, isUserLoaded }}>
      {children}
    </UserContext.Provider>
  );
}
