import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Share from "react-native-share";
import { RewardedAdManager } from "../../ads/Admobmanager";
import { colors } from "../../constants/colors";
import {
  getLeaderboard,
  getTodaySessionCount,
} from "../../constants/leaderboard";
import { trackScreen } from "../../constants/mixpanel";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.pushdaily.homeworkout.fit";

const ms = (n) => scaling().moderateScale(n);
const CHART_H = ms(150); // height of the bar plotting area

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

const barColorFor = (row) =>
  row.isUser
    ? colors.primary
    : row.rank === 1
      ? "#F59E0B"
      : row.rank === 2
        ? "#9CA3AF"
        : row.rank === 3
          ? "#D97706"
          : "#C7D2DA";

// A single animated vertical bar (grows from the bottom on first load).
function ChartBar({ row, max, index }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      delay: 150 + index * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animates height
    }).start();
  }, []);

  const pct = max > 0 ? Math.max(0.06, row.pushups / max) : 0.06;
  const color = barColorFor(row);
  const firstName = row.isUser ? "You" : (row.name || "").split(" ")[0];

  return (
    <View style={styles.barItem}>
      <Animated.Text style={[styles.barValue, { opacity: anim }]}>
        {row.pushups}
      </Animated.Text>

      <View style={styles.barWrap}>
        <Animated.View
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, pct * CHART_H],
              }),
            },
          ]}
        />
      </View>

      <Text style={styles.barRank}>{MEDALS[row.rank] || `#${row.rank}`}</Text>
      <Text style={styles.barFlag}>{row.flag}</Text>
      <Text
        style={[styles.barName, row.isUser && styles.barNameUser]}
        numberOfLines={1}
      >
        {firstName}
      </Text>
    </View>
  );
}

export default function EventScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [board, setBoard] = useState({ top: [], me: { rank: 0, best: 0 } });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const b = await getLeaderboard(user?._id, user?.name);
      setBoard(b);
    } catch {}
    setRefreshing(false);
  };

  const enter = useRef(new Animated.Value(0)).current;
  const didEnter = useRef(false);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(colors.background);
      }

      trackScreen("Event");
      let active = true;
      getLeaderboard(user?._id, user?.name).then((b) => active && setBoard(b));
      // Warm up the rewarded ad for extra-session unlocks.
      try {
        RewardedAdManager.getInstance().load();
      } catch {}

      if (!didEnter.current) {
        didEnter.current = true;
        Animated.timing(enter, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
      return () => {
        active = false;
      };
    }, [user?.name]),
  );

  const maxPushups = board.top.length ? board.top[0].pushups || 1 : 1;

  // Top 5 arranged so #1 is centered, flanked by 2 & 3, then 4 & 5 (podium look).
  const top5 = board.top.slice(0, 5);
  const podium = [3, 1, 0, 2, 4].map((i) => top5[i]).filter(Boolean);

  // ── Rotating trash-talk above the Start button (only with records) ──
  const leader = board.top[0];
  const leaderName = leader ? (leader.name || "").trim().split(" ")[0] : "";
  const taunts = leader?.isUser
    ? [
        "You're #1 — defend your crown 👑",
        "Nobody's caught you yet 🔥",
        "Keep the throne, champ 💪",
        "Stay untouchable 😎",
      ]
    : [
        `Are you sure you can beat ${leaderName}? 😤`,
        `Let's show ${leaderName} who's the real gangsta 😎`,
        `Let's beat ${leaderName}! 🔥`,
        `Show them who's worth it 💪`,
        `Hattkeee!!! move aside ${leaderName} 😏`,
      ];

  const tauntAnim = useRef(new Animated.Value(1)).current;
  const [tauntIndex, setTauntIndex] = useState(0);
  const showTaunts = board.top.length > 0;

  useEffect(() => {
    if (!showTaunts) return;
    setTauntIndex(0);
    const id = setInterval(() => {
      Animated.timing(tauntAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setTauntIndex((i) => (i + 1) % taunts.length);
        Animated.timing(tauntAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 2600);
    return () => clearInterval(id);
    // Restart the cycle when the leader (and thus the taunt set) changes.
  }, [showTaunts, leaderName, leader?.isUser]);

  const waitForAd = async (mgr, timeoutMs = 12000) => {
    if (mgr.isLoaded()) return true;
    mgr.load();
    const t0 = Date.now();
    while (!mgr.isLoaded() && Date.now() - t0 < timeoutMs) {
      await new Promise((r) => setTimeout(r, 600));
    }
    return mgr.isLoaded();
  };

  // First push-up session of the day is free; extra sessions need a rewarded ad.
  const onStart = async () => {
    const n = await getTodaySessionCount();
    if (n < 1) {
      router.push("/event/pushup");
      return;
    }
    const watch = await new Promise((resolve) => {
      Alert.alert(
        "Log another session?",
        "You've already logged a push-up session today. Watch a short ad to log another and keep climbing the board.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Watch ad", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!watch) return;

    const mgr = RewardedAdManager.getInstance();
    const ready = await waitForAd(mgr);
    if (!ready) {
      Alert.alert("Ad not ready", "Please try again in a moment.");
      return;
    }
    const { earned } = await mgr.show();
    if (earned) router.push("/event/pushup");
  };

  const handleShare = async () => {
    const best = board.me.best;
    const msg = best
      ? `I just hit ${best} push-ups on Push Daily 💪🔥 Think you can beat me?\n\n${PLAY_STORE_URL}`
      : `I'm training push-ups on Push Daily 💪 Join the challenge!\n\n${PLAY_STORE_URL}`;
    try {
      await Share.open({
        title: "My push-up score",
        message: msg,
        failOnCancel: false,
      });
    } catch {
      // user dismissed — ignore
    }
  };

  return (
    <View style={styles.screen}>
      {/* Hero header */}
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [-10, 0],
              }),
            },
          ],
        }}
      >
        <LinearGradient
          colors={[colors.primary, "#7C3AED"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>WEEKLY EVENT</Text>
              <Text style={styles.heroTitle}>Push-Up Champions 💪</Text>
              <Text style={styles.heroSub}>Top 10 athletes worldwide</Text>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.heroTrophy}>🏆</Text>
              <TouchableOpacity
                style={styles.sharePill}
                onPress={handleShare}
                activeOpacity={0.85}
              >
                <Ionicons name="share-social" size={ms(13)} color="#FFFFFF" />
                <Text style={styles.sharePillText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.meCard}>
            <View>
              <Text style={styles.meLabel}>Your best</Text>
              <Text style={styles.meValue}>{board.me.best} push-ups</Text>
            </View>
            <View style={styles.meRankWrap}>
              <Text style={styles.meRankLabel}>Rank</Text>
              <Text style={styles.meRank}>#{board.me.rank}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={styles.sectionLabel}>Leaderboard</Text>

        {/* ── Bar chart (top 5, #1 centered, no horizontal scroll) ── */}
        <View style={styles.chartCard}>
          {podium.length === 0 ? (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyEmoji}>🥇</Text>
              <Text style={styles.emptyTitle}>Become the first champion!</Text>
              <Text style={styles.emptyText}>
                No push-ups logged yet. Complete a session and claim the very
                first spot on the board.
              </Text>
            </View>
          ) : (
            <View style={styles.chartRow}>
              {podium.map((row, i) => (
                <ChartBar
                  key={`${row.rank}-${row.name}`}
                  row={row}
                  max={maxPushups}
                  index={i}
                />
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footNote}>
          Complete a session to upload your count and climb the board.
        </Text>
      </ScrollView>

      {/* Start button pinned above the tab bar */}
      <Animated.View
        style={[
          styles.ctaWrap,
          {
            opacity: enter,
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {showTaunts && (
          <Animated.Text
            style={[styles.tauntText, { opacity: tauntAnim }]}
            numberOfLines={1}
          >
            {taunts[tauntIndex]}
          </Animated.Text>
        )}

        <TouchableOpacity
          style={styles.startBtn}
          activeOpacity={0.9}
          onPress={onStart}
        >
          <Ionicons name="play" size={ms(18)} color="#FFFFFF" />
          <Text style={styles.startText}>Start Push-Up</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FA" },

  hero: {
    paddingTop: ms(16),
    paddingHorizontal: ms(18),
    paddingBottom: ms(20),
    borderBottomLeftRadius: ms(26),
    borderBottomRightRadius: ms(26),
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroEyebrow: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(10),
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.8)",
  },
  heroTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(22),
    color: "#FFFFFF",
    marginTop: ms(2),
  },
  heroSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.85)",
    marginTop: ms(2),
  },
  heroTrophy: { fontSize: ms(36) },
  heroRight: { alignItems: "center", gap: ms(8) },
  sharePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(4),
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: ms(999),
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  sharePillText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11),
    color: "#FFFFFF",
  },

  meCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: ms(16),
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
    marginTop: ms(16),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  meLabel: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: "rgba(255,255,255,0.85)",
  },
  meValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: "#FFFFFF",
    marginTop: ms(2),
  },
  meRankWrap: { alignItems: "center" },
  meRankLabel: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10),
    color: "rgba(255,255,255,0.85)",
  },
  meRank: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(20),
    color: "#FFFFFF",
  },

  listContent: {
    paddingHorizontal: ms(16),
    paddingTop: ms(14),
    paddingBottom: ms(150),
  },
  sectionLabel: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.text,
    marginBottom: ms(10),
    marginLeft: ms(2),
  },

  // ── Bar chart ──
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(18),
    paddingVertical: ms(16),
    paddingHorizontal: ms(6),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
  },
  emptyChart: {
    alignItems: "center",
    paddingVertical: ms(24),
    paddingHorizontal: ms(16),
  },
  emptyEmoji: { fontSize: ms(40), marginBottom: ms(8) },
  emptyTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: colors.text,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12.5),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(19),
    marginTop: ms(6),
  },
  barItem: {
    flex: 1,
    alignItems: "center",
  },
  barValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.text,
    marginBottom: ms(6),
  },
  barWrap: {
    height: CHART_H,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: ms(24),
    borderTopLeftRadius: ms(7),
    borderTopRightRadius: ms(7),
    borderBottomLeftRadius: ms(3),
    borderBottomRightRadius: ms(3),
  },
  barRank: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.textLight,
    marginTop: ms(8),
  },
  barFlag: { fontSize: ms(16), marginTop: ms(2) },
  barName: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10.5),
    color: colors.text,
    marginTop: ms(2),
    maxWidth: ms(50),
  },
  barNameUser: {
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.primary,
  },

  footNote: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    textAlign: "center",
    marginTop: ms(14),
  },

  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: ms(86),
    paddingHorizontal: ms(18),
  },
  tauntText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.primary,
    textAlign: "center",
    marginBottom: ms(8),
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(54),
    borderRadius: ms(18),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  startText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: "#FFFFFF",
  },
});
