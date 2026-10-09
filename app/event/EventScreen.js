import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  leaderboardNudge,
  sayOncePerSession,
} from "../../constants/bubbleMessage";
import { Image } from "expo-image";

import BrandGradient from "../../components/ui/BrandGradient";
import { colors } from "../../constants/colors";
import {
  getLeaderboard,
  getTodaySessionCount,
  msUntilUtcReset,
} from "../../constants/leaderboard";
import { trackScreen } from "../../constants/mixpanel";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import { EXPRESSION_IMAGES } from "../../constants/widgetPromo";

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

// The real username (from the record, or the local profile name for the
// current user) instead of a generic "You".
const displayName = (row, userName) =>
  row.name && row.name !== "Anonymous" ? row.name : row.isUser ? userName || "" : "";

// A single animated vertical bar (grows from the bottom on first load).
function ChartBar({ row, max, index, userName, onShowName }) {
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
  const rawName = displayName(row, userName);
  const firstName = rawName.split(" ")[0] || (row.isUser ? "You" : "Anon");

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

      {/* Bars are narrow, so long names get clipped — tap to see the full one. */}
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => rawName && onShowName?.(rawName)}
        hitSlop={{ top: 4, bottom: 8, left: 6, right: 6 }}
      >
        <Text
          style={[styles.barName, row.isUser && styles.barNameUser]}
          numberOfLines={1}
        >
          {firstName}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function EventScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [board, setBoard] = useState({
    top: [],
    me: { rank: 0, best: 0, lifetime: 0 },
  });
  const [refreshing, setRefreshing] = useState(false);
  // Only true for the very first fetch — pull-to-refresh has its own spinner.
  const [loadingBoard, setLoadingBoard] = useState(true);
  // Full name shown when a clipped leaderboard name is tapped.
  const [nameTip, setNameTip] = useState(null);
  const [resetIn, setResetIn] = useState(msUntilUtcReset());

  // The board is global, so it rolls over at UTC midnight for everyone.
  useEffect(() => {
    const id = setInterval(() => setResetIn(msUntilUtcReset()), 30000);
    return () => clearInterval(id);
  }, []);

  const resetLabel = (() => {
    const h = Math.floor(resetIn / 3600000);
    const m = Math.floor((resetIn % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const b = await getLeaderboard(user?._id, user?.name);
      setBoard(b);
    } catch {}
    setRefreshing(false);
  };

  // The tooltip fades itself out — no dismiss tap needed for a name.
  const tipAnim = useRef(new Animated.Value(0)).current;
  const tipTimer = useRef(null);

  const showNameTip = (name) => {
    clearTimeout(tipTimer.current);
    setNameTip(name);
    tipAnim.setValue(0);
    Animated.timing(tipAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    tipTimer.current = setTimeout(() => {
      Animated.timing(tipAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setNameTip(null));
    }, 2200);
  };

  useEffect(() => () => clearTimeout(tipTimer.current), []);

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
      getLeaderboard(user?._id, user?.name)
        .then((b) => {
          if (!active) return;
          setBoard(b);

          // Once the real data is in, Jack reacts to who is actually leading.
          const top = b?.top?.[0];
          const lead = top?.isUser
            ? null // don't tell someone to beat themselves
            : (top?.name || "").trim().split(" ")[0];
          setTimeout(
            () => sayOncePerSession("leaderboard", leaderboardNudge(lead)),
            900,
          );
        })
        .finally(() => active && setLoadingBoard(false));
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

  // What it takes to climb: the gap to the next spot up, in push-ups.
  const chase = (() => {
    const me = board.me;
    if (loadingBoard) return null;
    if (board.top.length === 0) return { icon: "flag", text: "Log a session and claim #1 today" };
    if (!me.best) return { icon: "flag", text: "One session puts you on today's board" };
    if (me.rank === 1) return { icon: "trophy", text: "You're #1 today — defend your crown 👑" };
    const target =
      board.top.find((r) => r.rank === me.rank - 1) || (me.rank > 5 ? board.top[board.top.length - 1] : null);
    if (!target) return null;
    const need = Math.max(1, (target.pushups || 0) - me.best + 1);
    const who = displayName(target, user?.name).split(" ")[0] || `#${target.rank}`;
    return {
      icon: "trending-up",
      text: `${need} more push-up${need === 1 ? "" : "s"} to pass ${who} (#${target.rank})`,
    };
  })();

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
        <BrandGradient style={styles.hero}>
          <View style={styles.heroRow}>
            <Image source={EXPRESSION_IMAGES.flex} style={styles.heroMascot} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Daily Push-Up Challenge</Text>
              <View style={styles.resetPill}>
                <Ionicons name="time-outline" size={ms(11)} color="#FFFFFF" />
                <Text style={styles.resetText}>Resets in {resetLabel}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.85}
              accessibilityLabel="Share your score"
            >
              <Ionicons name="share-social" size={ms(17)} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Your numbers, side by side */}
          <View style={styles.meCard}>
            <View style={styles.meStat}>
              <Text style={styles.meValue}>{board.me.best}</Text>
              <Text style={styles.meLabel}>Today&apos;s best</Text>
            </View>
            <View style={styles.meDivider} />
            <View style={styles.meStat}>
              <Text style={styles.meValue}>{board.me.rank ? `#${board.me.rank}` : "—"}</Text>
              <Text style={styles.meLabel}>Your rank</Text>
            </View>
            <View style={styles.meDivider} />
            <View style={styles.meStat}>
              <Text style={styles.meValue}>{board.me.lifetime ?? 0}</Text>
              <Text style={styles.meLabel}>All-time</Text>
            </View>
          </View>

          {chase ? (
            <View style={styles.chasePill}>
              <Ionicons name={chase.icon} size={ms(13)} color={colors.primary} />
              <Text style={styles.chaseText} numberOfLines={1}>
                {chase.text}
              </Text>
            </View>
          ) : null}
        </BrandGradient>
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
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionLabel}>Today&apos;s top 5</Text>
            <Text style={styles.sectionNote}>Global leaderboard · pull down to refresh</Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* ── Podium chart (top 5, #1 centered) + the full ranked list ── */}
        <View style={styles.chartCard}>
          {loadingBoard ? (
            // Contained in the chart card only — the hero and Start button stay
            // usable while the board loads.
            <View style={styles.chartLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.chartLoadingText}>
                Loading today&apos;s leaderboard…
              </Text>
            </View>
          ) : podium.length === 0 ? (
            <View style={styles.emptyChart}>
              <Image source={EXPRESSION_IMAGES.wink} style={styles.emptyMascot} contentFit="contain" />
              <Text style={styles.emptyTitle}>Become the first champion!</Text>
              <Text style={styles.emptyText}>
                No push-ups logged yet today. Finish one session and the top
                spot is yours.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.chartRow}>
                {podium.map((row, i) => (
                  <ChartBar
                    key={`${row.rank}-${row.name}`}
                    row={row}
                    max={maxPushups}
                    index={i}
                    userName={user?.name}
                    onShowName={showNameTip}
                  />
                ))}
              </View>

              <View style={styles.rankList}>
                {top5.map((row) => {
                  const name = displayName(row, user?.name) || "Anonymous";
                  return (
                    <View
                      key={`row-${row.rank}-${row.name}`}
                      style={[styles.rankRow, row.isUser && styles.rankRowUser]}
                    >
                      <Text style={styles.rankNum}>{MEDALS[row.rank] || `#${row.rank}`}</Text>
                      <View style={[styles.avatar, { backgroundColor: barColorFor(row) + "26" }]}>
                        <Text style={[styles.avatarText, { color: row.isUser ? colors.primary : colors.text }]}>
                          {name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.rankName, row.isUser && styles.rankNameUser]} numberOfLines={1}>
                        {name}
                        {row.isUser ? "  · You" : ""}
                      </Text>
                      <Text style={styles.rankScore}>
                        {row.pushups}
                        <Text style={styles.rankUnit}> reps</Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* ── How it works — three steps, no reading required ── */}
        <View style={styles.howCard}>
          {[
            { icon: "phone-portrait-outline", text: "Prop your phone up" },
            { icon: "scan-outline", text: "AI camera counts every rep" },
            { icon: "podium-outline", text: "Climb today's board" },
          ].map((s, i) => (
            <View key={s.text} style={styles.howStep}>
              <View style={styles.howIcon}>
                <Ionicons name={s.icon} size={ms(17)} color={colors.primary} />
                <View style={styles.howNum}>
                  <Text style={styles.howNumText}>{i + 1}</Text>
                </View>
              </View>
              <Text style={styles.howText}>{s.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Full name for a clipped leaderboard entry — fades out on its own. */}
      {nameTip ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.nameTip,
            {
              opacity: tipAnim,
              transform: [
                {
                  translateY: tipAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.nameTipText} numberOfLines={2}>
            {nameTip}
          </Text>
        </Animated.View>
      ) : null}

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
          <Animated.View style={[styles.tauntPill, { opacity: tauntAnim }]}>
            <Text style={styles.tauntText} numberOfLines={1}>
              {taunts[tauntIndex]}
            </Text>
          </Animated.View>
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

  // ── Hero ──
  hero: {
    paddingTop: ms(12),
    paddingHorizontal: ms(16),
    paddingBottom: ms(16),
    borderBottomLeftRadius: ms(26),
    borderBottomRightRadius: ms(26),
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
  },
  heroMascot: { width: ms(54), height: ms(54), marginVertical: -ms(4) },
  heroTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(17),
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  resetPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: ms(4),
    marginTop: ms(4),
    backgroundColor: "rgba(0,0,0,0.14)",
    borderRadius: 999,
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
  },
  resetText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(10.5),
    color: "#FFFFFF",
  },
  shareBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },

  meCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: ms(16),
    paddingVertical: ms(10),
    marginTop: ms(12),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  meStat: { flex: 1, alignItems: "center" },
  meDivider: { width: 1, height: ms(28), backgroundColor: "rgba(255,255,255,0.25)" },
  meValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(19),
    color: "#FFFFFF",
  },
  meLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10.5),
    color: "rgba(255,255,255,0.85)",
    marginTop: 1,
  },

  chasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(6),
    marginTop: ms(10),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(12),
    paddingHorizontal: ms(12),
    paddingVertical: ms(8),
  },
  chaseText: {
    flex: 1,
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.text,
  },

  // ── Body ──
  listContent: {
    paddingHorizontal: ms(16),
    paddingTop: ms(16),
    paddingBottom: ms(170),
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: ms(10),
    paddingHorizontal: ms(2),
  },
  sectionLabel: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: colors.text,
  },
  sectionNote: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: 1,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FDECEC",
    borderRadius: 999,
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  liveText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(9.5),
    letterSpacing: 0.8,
    color: "#DC2626",
  },

  // ── Chart + ranked list ──
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(20),
    paddingTop: ms(16),
    paddingBottom: ms(8),
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
    paddingTop: ms(4),
    paddingBottom: ms(18),
    paddingHorizontal: ms(16),
  },
  emptyMascot: { width: ms(90), height: ms(90), marginBottom: ms(4) },
  nameTip: {
    position: "absolute",
    left: ms(28),
    right: ms(28),
    bottom: ms(170),
    backgroundColor: "rgba(17,24,39,0.94)",
    borderRadius: ms(12),
    paddingVertical: ms(10),
    paddingHorizontal: ms(14),
  },
  nameTipText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12.5),
    color: "#FFFFFF",
    textAlign: "center",
  },

  // Same footprint as the chart so the card doesn't jump when data lands.
  chartLoading: {
    alignItems: "center",
    justifyContent: "center",
    gap: ms(10),
    paddingVertical: ms(44),
  },
  chartLoadingText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11.5),
    color: colors.textLight,
  },
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
    width: ms(28),
    borderTopLeftRadius: ms(9),
    borderTopRightRadius: ms(9),
    borderBottomLeftRadius: ms(4),
    borderBottomRightRadius: ms(4),
  },
  barRank: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.textLight,
    marginTop: ms(8),
  },
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

  rankList: {
    marginTop: ms(14),
    marginHorizontal: ms(6),
    borderTopWidth: 1,
    borderTopColor: "#F1F3F6",
    paddingTop: ms(6),
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    paddingVertical: ms(8),
    paddingHorizontal: ms(8),
    borderRadius: ms(12),
  },
  rankRowUser: { backgroundColor: colors.primary + "12" },
  rankNum: {
    width: ms(26),
    textAlign: "center",
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.textLight,
  },
  avatar: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(13) },
  rankName: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
    color: colors.text,
  },
  rankNameUser: { color: colors.primary, fontFamily: "OpenSans_800ExtraBold" },
  rankScore: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(14), color: colors.text },
  rankUnit: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(10), color: colors.textLight },

  // ── How it works ──
  howCard: {
    flexDirection: "row",
    marginTop: ms(14),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(18),
    paddingVertical: ms(14),
    paddingHorizontal: ms(6),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  howStep: { flex: 1, alignItems: "center", paddingHorizontal: ms(4) },
  howIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(14),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  howNum: {
    position: "absolute",
    top: -ms(5),
    right: -ms(5),
    width: ms(17),
    height: ms(17),
    borderRadius: ms(9),
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  howNumText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(8.5), color: "#FFFFFF" },
  howText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11),
    lineHeight: ms(15),
    color: colors.text,
    textAlign: "center",
    marginTop: ms(8),
  },

  // ── Pinned CTA ──
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: ms(86),
    paddingHorizontal: ms(18),
    alignItems: "stretch",
  },
  tauntPill: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary + "33",
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    marginBottom: ms(8),
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tauntText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12.5),
    color: colors.primary,
    textAlign: "center",
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
