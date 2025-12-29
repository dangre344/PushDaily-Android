import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("token").then((token) => {
      setIsLoggedIn(!!token);
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return <Redirect href={isLoggedIn ? "/(tabs)" : "/signup"} />;
}
