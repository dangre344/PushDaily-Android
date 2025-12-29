import { createContext, useContext, useEffect, useState } from "react";
import { Logger } from "./Logger";
import { getSession } from "./SessionManager";

import React from "react";

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export default function UserProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      Logger.log("session--->", session);
      if (session) setUser(session);
    })();
  }, []);

  const updateUser = (data) => {
    const updated = { ...(user || {}), ...data };
    setUser(updated);
  };

  return (
    <UserContext.Provider value={{ user, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}
