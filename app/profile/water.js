import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";

import { AD_UNIT_IDS } from "../../ads/Admobmanager";
import PeriodPanel from "../../components/health/PeriodPanel";
import WaterPanel from "../../components/health/WaterPanel";
import { colors } from "../../constants/colors";
import { selectionHaptic } from "../../constants/haptics";
import { Logger } from "../../constants/Logger";
import { isPartnerMode } from "../../constants/periodReminders";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

// Water = a glass, Periods = a blood drop. Two different shapes (not two
// drops), and each keeps its own colour even when not selected, so the tabs
// never look alike.
const TABS = [
  { id: "water", label: "Water", icon: "cup-water", color: "#2E90FA" },
  { id: "period", label: "Periods", icon: "water", color: "#DC2626" },
];

/**
 * Water Reminder & Period tracking — one screen, two tabs.
 *
 * Route: /profile/water            → Water tab (water notifications deep-link here)
 *        /profile/water?tab=period → Periods tab
 *
 * Opened from one Profile item, "Water Reminder & Period Tracking". Women
 * track their own cycle; everyone else sees it framed as their partner's.
 */
export default function WaterAndPeriodsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useUser();
  const partner = isPartnerMode(user?.gender);

  const showPeriods = true;
  const [tab, setTab] = useState(params?.tab === "period" ? "period" : "water");
  // Keep a tab mounted once visited, so switching back doesn't reload it.
  const [visited, setVisited] = useState({ [tab]: true });

  const [barW, setBarW] = useState(0);
  const slide = useRef(new Animated.Value(tab === "period" ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: tab === "period" ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, slide]);

  const select = (id) => {
    if (id === tab) return;
    selectionHaptic();
    setTab(id);
    setVisited((v) => ({ ...v, [id]: true }));
  };

  const pillW = barW > 0 ? (barW - 6) / 2 : 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={6}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={ms(22)} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {tab !== "period" ? "Water Reminder" : partner ? "Partner's Cycle" : "Period Tracking"}
          </Text>
          <Text style={styles.subtitle}>
            {tab !== "period"
              ? "Stay hydrated, stay strong"
              : partner
                ? "Track her cycle and know when to care a little more"
                : "Cycle predictions, history & care tips"}
          </Text>
        </View>
      </View>

      {showPeriods ? (
        <View style={styles.tabsWrap}>
          <View style={styles.tabs} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            {pillW > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tabPill,
                  {
                    width: pillW,
                    transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, pillW] }) }],
                  },
                ]}
              />
            ) : null}
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={styles.tabBtn}
                  onPress={() => select(t.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <MaterialCommunityIcons
                    name={t.icon}
                    size={ms(17)}
                    color={t.color}
                    style={{ opacity: on ? 1 : 0.5 }}
                  />
                  <Text style={[styles.tabText, on && { color: colors.text, fontFamily: "OpenSans_800ExtraBold" }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {visited.water ? (
          <View style={[styles.pane, tab !== "water" && styles.hidden]}>
            <WaterPanel visible={tab === "water"} />
          </View>
        ) : null}
        {showPeriods && visited.period ? (
          <View style={[styles.pane, tab !== "period" && styles.hidden]}>
            <PeriodPanel />
          </View>
        ) : null}
      </View>

      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          onAdFailedToLoad={(e) => Logger.log("[AdMob] Banner failed:", String(e))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8F5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: ms(10),
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    backgroundColor: "#FFF0EB",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(19), color: colors.text },
  subtitle: { fontFamily: "OpenSans_500Medium", fontSize: ms(11), color: colors.textLight, marginTop: 2 },

  tabsWrap: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: ms(16),
    paddingBottom: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: "#F0E6E0",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: ms(14),
    padding: 3,
  },
  // No `elevation` here: on Android elevation also raises z-order, which drew
  // the pill OVER the selected tab's icon and label. A hairline border gives
  // the same lift without that.
  tabPill: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: ms(11),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 0,
  },
  tabBtn: {
    flex: 1,
    height: ms(38),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 1,
  },
  tabText: { fontFamily: "OpenSans_700Bold", fontSize: ms(13.5), color: colors.textLight },

  body: { flex: 1 },
  pane: { flex: 1 },
  // Hidden panes stay mounted (state and scroll kept) but are not laid out.
  hidden: { display: "none" },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: ms(52),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0E6E0",
  },
});
