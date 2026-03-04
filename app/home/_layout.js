import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";
import { StatusBar, StyleSheet } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../../constants/colors.js";
import { scaling } from "../../constants/useScaling";
import WorkoutScreen from "../workouts/workoutscreen.js";
import ProfileScreen from "./ProfileScreen.js";
import ProgressScreen from "./ProgressScreen.js";

const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function Home() {
  const { t } = useTranslation();

  const Tab = createBottomTabNavigator();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary, // 🔥 Primary color
          tabBarInactiveTintColor: "#999",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            height: scaleHeight(70),
            paddingBottom: 10,
          },
          tabBarIcon: ({ color, size }) => {
            let iconName;
            if (route.name === "Workout") iconName = "barbell-outline";
            else if (route.name === "Progress")
              iconName = "stats-chart-outline";
            else if (route.name === "Profile") iconName = "person-outline";
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Workout"
          options={{ headerShown: false }}
          component={WorkoutScreen}
        />
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    marginTop: 4,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    marginBottom: 32,
  },
  optionsContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
    marginBottom: 8,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    marginTop: 8,
  },
  dayButton: {
    flex: 1,
    minWidth: "28%",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
  },

  inputMargin: {
    marginTop: 15,
    marginBottom: 5,
  },
  dayButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.white,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: "center",
  },
  quickButtonText: {
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  skipText: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
  },
});
