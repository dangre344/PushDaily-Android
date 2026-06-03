import CustomSplashScreen from "@/components/CustomSplashScreen";
import { useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Logger } from "../constants/Logger";
import { useUser } from "../constants/UserContext";

export default function SplashIndex() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { user, isUserLoaded } = useUser();
  const hasRedirected = useRef(false);

  useEffect(() => {
    const boot = async () => {
      if (!isUserLoaded) return;
      if (!rootNavigationState?.key) return;
      if (hasRedirected.current) return;

      hasRedirected.current = true;

      try {
        Logger.log("Splash boot — user:", user);

        setTimeout(() => {
          if (user?.name) {
            router.replace("/home");
          } else {
            router.replace("/signup");
          }
        }, 100);
      } catch (error) {
        Logger.log("[Splash] Boot failed:", String(error));
        router.replace("/signup");
      }
    };

    boot();
  }, [isUserLoaded, user, rootNavigationState?.key, router]);

  return <CustomSplashScreen />;
}
