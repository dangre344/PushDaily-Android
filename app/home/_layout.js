import { SafeAreaView } from "react-native-safe-area-context";

import {
  Animated,
  Dimensions,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useRef, useState } from "react";
import TabTourOverlay, {
  hasSeenTabTour,
} from "../../components/ui/TabTourOverlay.js";
import { colors } from "../../constants/colors.js";
import { trackScreen } from "../../constants/mixpanel.js";
import { registerTabNavigation } from "../../constants/tabNavigation.js";
import { scaling } from "../../constants/useScaling";
import EventScreen from "../event/EventScreen.js";
import ProfileScreen from "../profile/ProfileScreen.js";
import ProgressScreen from "../progress/ProgressScreen.js";
import QuizScreen from "../quiz/QuizScreen.js";
import WorkoutScreen from "../workouts/workoutscreen.js";

const { scaleHeight, scaleWidth, moderateScale } = scaling();

const Tab = createBottomTabNavigator();
const ms = (n) => scaling().moderateScale(n);
const { width } = Dimensions.get("window");

const TABS = [
  { name: "Quiz", icon: "help-circle-outline", activeIcon: "help-circle" },

  {
    name: "Attendance",
    icon: "stats-chart-outline",
    activeIcon: "stats-chart",
  },

  { name: "Workouts", icon: "barbell-outline", activeIcon: "barbell" },

  { name: "Event", icon: "trophy-outline", activeIcon: "trophy" },
  { name: "Profile", icon: "person-outline", activeIcon: "person" },
];

// ─── Single tab button ────────────────────────────────────────────────────────
const TabButton = ({ tab, isFocused, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const labelTranslate = useRef(new Animated.Value(isFocused ? 0 : 6)).current;

  useEffect(() => {
    if (isFocused) {
      // Pop + rise animation on focus
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.25,
            tension: 80,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(translateAnim, {
          toValue: -6,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(labelTranslate, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(labelTranslate, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={tabStyles.btn}
    >
      <Animated.View
        style={[
          tabStyles.iconWrap,
          { transform: [{ translateY: translateAnim }, { scale: scaleAnim }] },
        ]}
      >
        {/* Active pill background */}
        <Animated.View
          style={[tabStyles.activePill, { opacity: opacityAnim }]}
        />

        <Ionicons
          name={isFocused ? tab.activeIcon : tab.icon}
          size={ms(22)}
          color={isFocused ? colors.primary : colors.muted}
        />
      </Animated.View>

      {/* Label slides up and fades in when active */}
      <Animated.Text
        style={[
          tabStyles.label,
          {
            color: isFocused ? colors.primary : colors.muted,
            opacity: labelOpacity,
            transform: [{ translateY: labelTranslate }],
          },
        ]}
      >
        {tab.name}
      </Animated.Text>
    </TouchableOpacity>
  );
};

// ─── Custom tab bar ───────────────────────────────────────────────────────────
const CustomTabBar = ({ state, navigation }) => {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Expose the tab navigation so notification taps can jump to a tab.
  registerTabNavigation(navigation);

  // Entrance animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        tabStyles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Glow line at top */}
      <View style={tabStyles.glowLine} />

      <View style={tabStyles.inner}>
        {TABS.map((tab, index) => (
          <TabButton
            key={tab.name}
            tab={tab}
            isFocused={state.index === index}
            onPress={() => navigation.navigate(tab.name)}
          />
        ))}
      </View>
    </Animated.View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ═════════════════════════════════════════════════════════════════════════════
export default function AppLayout() {
  const [showTour, setShowTour] = useState(false);

  // First app open only: walk the user through the tabs. Delayed slightly so
  // it doesn't collide with the tab bar's own entrance animation.
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        const seen = await hasSeenTabTour();
        if (!seen && active) setShowTour(true);
      } catch {}
    }, 1200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, []);

  return (
    <SafeAreaView style={layoutStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Tab.Navigator
        initialRouteName="Workouts" // 👈 Added: set Workouts as default tab
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
        screenListeners={({ route }) => ({
          // Bottom-tab switches keep the same /home pathname, so track them here.
          // Gated by the Remote Config flag inside trackScreen().
          focus: () => trackScreen(route.name),
        })}
      >
        <Tab.Screen name="Quiz" component={QuizScreen} />

        <Tab.Screen name="Attendance" component={ProgressScreen} />

        <Tab.Screen name="Workouts" component={WorkoutScreen} />

        <Tab.Screen name="Event" component={EventScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>

      <TabTourOverlay visible={showTour} onDone={() => setShowTour(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const tabStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    overflow: "hidden",
    paddingBottom: ms(4),

    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  glowLine: {
    height: 1,
    marginHorizontal: ms(40),
    backgroundColor: colors.primary,
    opacity: 0.4,
    borderRadius: 1,
  },
  inner: {
    flexDirection: "row",
    paddingTop: ms(8),
    paddingHorizontal: ms(8),
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: ms(6),
    minHeight: ms(52),
  },
  iconWrap: {
    width: ms(46),
    height: ms(36),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ms(12),
  },
  activePill: {
    position: "absolute",
    width: ms(46),
    height: ms(36),
    borderRadius: ms(12),
    backgroundColor: colors.primary + "20",
    borderWidth: 1,
    borderColor: colors.primary + "35",
  },
  label: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10),
    marginTop: ms(3),
  },
});

const layoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
