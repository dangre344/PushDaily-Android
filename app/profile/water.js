import { useRouter } from "expo-router";
import WaterReminderModal from "./WaterReminderModal";

// Standalone route for the Water Reminder so a tapped water notification can
// deep-link straight to it (see the response listener in app/_layout.tsx).
export default function WaterScreen() {
  const router = useRouter();
  return <WaterReminderModal visible setVisible={() => router.back()} />;
}
