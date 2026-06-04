import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";
import { AD_UNIT_IDS } from "../../ads/Admobmanager";
import { colors } from "../../constants/colors";
import { Logger } from "../../constants/Logger";
import {
  MILESTONE_CATEGORIES,
  getCategory,
  getMilestones,
} from "../../constants/milestones";
import { scaling } from "../../constants/useScaling";
import { getMilestoneStats, initDB } from "../../offlinedb/workoutdb";

const ms = (n) => scaling().moderateScale(n);
// Manual thousands separator — Hermes doesn't reliably group via toLocaleString.
const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ─── Single milestone card (own entrance + progress animation) ───────────────
const MilestoneCard = ({ item, index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const cat = getCategory(item.category);
  const accent = item.unlocked ? cat.color : "#CBD5E1";

  useEffect(() => {
    const delay = 60 + Math.min(index, 12) * 40;
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay,
      useNativeDriver: true,
    }).start();
    Animated.timing(progressAnim, {
      toValue: item.progress,
      duration: 800,
      delay: delay + 80,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        item.unlocked && { borderColor: cat.color + "55" },
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.emojiWrap,
          {
            backgroundColor: item.unlocked ? cat.color + "1A" : "#F1F5F9",
          },
        ]}
      >
        <Text style={[styles.emoji, !item.unlocked && styles.emojiLocked]}>
          {item.emoji}
        </Text>

        {item.unlocked && (
          <View style={[styles.checkBadge, { backgroundColor: cat.color }]}>
            <Ionicons name="checkmark" size={ms(11)} color="#FFFFFF" />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.cardTitle, !item.unlocked && styles.lockedText]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.unlocked ? (
            <View style={[styles.statusPill, { backgroundColor: cat.color }]}>
              <Text style={styles.statusPillText}>Unlocked</Text>
            </View>
          ) : (
            <Ionicons name="lock-closed" size={ms(13)} color={colors.muted} />
          )}
        </View>

        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.desc}
        </Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: accent,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>

        <Text style={styles.progressLabel}>
          {item.unlocked
            ? "Completed 🎉"
            : `${fmt(Math.min(item.current, item.target))} / ${fmt(item.target)}`}
        </Text>
      </View>
    </Animated.View>
  );
};

// ─── Main modal ──────────────────────────────────────────────────────────────
export default function MilestonesModal({ visible, setVisible }) {
  const [data, setData] = useState({
    milestones: [],
    summary: { unlocked: 0, total: 0, percent: 0 },
  });

  const summaryBar = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayCount, setDisplayCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let active = true;

    (async () => {
      try {
        await initDB();
        const stats = await getMilestoneStats();
        if (!active) return;
        setData(getMilestones(stats));
      } catch (e) {
        Logger.log("[Milestones] failed to load stats:", String(e));
      }
    })();

    return () => {
      active = false;
    };
  }, [visible]);

  // Animate the summary bar + count-up whenever the data lands.
  useEffect(() => {
    summaryBar.setValue(0);
    countAnim.setValue(0);

    Animated.timing(summaryBar, {
      toValue: data.summary.percent,
      duration: 1000,
      delay: 150,
      useNativeDriver: false,
    }).start();

    const id = countAnim.addListener(({ value }) =>
      setDisplayCount(Math.round(value)),
    );
    Animated.timing(countAnim, {
      toValue: data.summary.unlocked,
      duration: 900,
      delay: 150,
      useNativeDriver: false,
    }).start();

    return () => countAnim.removeListener(id);
  }, [data.summary.unlocked, data.summary.percent]);

  let runningIndex = 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setVisible(false)}
            style={styles.closeBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={ms(22)} color={colors.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Milestones</Text>
            <Text style={styles.headerSubtitle}>
              Every rep counts toward your next badge
            </Text>
          </View>

          <View style={styles.trophyWrap}>
            <Ionicons name="trophy" size={ms(20)} color={colors.primary} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.summaryCount}>
                  {displayCount}
                  <Text style={styles.summaryTotal}>
                    {" "}
                    / {data.summary.total}
                  </Text>
                </Text>
                <Text style={styles.summaryLabel}>Milestones unlocked</Text>
              </View>

              <View style={styles.percentPill}>
                <Text style={styles.percentText}>{data.summary.percent}%</Text>
              </View>
            </View>

            <View style={styles.summaryTrack}>
              <Animated.View
                style={[
                  styles.summaryFill,
                  {
                    width: summaryBar.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>

            <Text style={styles.summaryHint}>
              Keep training to unlock them all 💪
            </Text>
          </View>

          {/* Category sections */}
          {MILESTONE_CATEGORIES.map((cat) => {
            const items = data.milestones.filter((m) => m.category === cat.key);
            if (items.length === 0) return null;

            const unlockedInCat = items.filter((m) => m.unlocked).length;

            return (
              <View key={cat.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: cat.color + "1A" },
                    ]}
                  >
                    <Ionicons name={cat.icon} size={ms(15)} color={cat.color} />
                  </View>
                  <Text style={styles.sectionTitle}>{cat.title}</Text>
                  <Text style={styles.sectionCount}>
                    {unlockedInCat}/{items.length}
                  </Text>
                </View>

                {items.map((item) => {
                  const card = (
                    <MilestoneCard
                      key={item.id}
                      item={item}
                      index={runningIndex}
                    />
                  );
                  runningIndex += 1;
                  return card;
                })}
              </View>
            );
          })}
        </ScrollView>

        {/* Pinned banner */}
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdFailedToLoad={(error) =>
              Logger.log("[AdMob] Banner failed:", String(error))
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: ms(12),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
  },
  closeBtn: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    backgroundColor: "#F4F6F8",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(19),
    color: colors.text,
  },
  headerSubtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(2),
  },
  trophyWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: ms(16),
    paddingBottom: ms(24),
  },

  // ── Summary ──
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(22),
    padding: ms(18),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    marginBottom: ms(18),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: ms(14),
  },
  summaryCount: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(30),
    color: colors.text,
  },
  summaryTotal: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(18),
    color: colors.textLight,
  },
  summaryLabel: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.textLight,
    marginTop: ms(2),
  },
  percentPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: ms(14),
    paddingVertical: ms(8),
    borderRadius: ms(999),
  },
  percentText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },
  summaryTrack: {
    height: ms(10),
    backgroundColor: "#E9EDF3",
    borderRadius: ms(999),
    overflow: "hidden",
  },
  summaryFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: ms(999),
  },
  summaryHint: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(10),
  },

  // ── Section ──
  section: {
    marginBottom: ms(18),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    marginBottom: ms(12),
  },
  sectionIcon: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(9),
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    flex: 1,
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: colors.text,
  },
  sectionCount: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.textLight,
  },

  // ── Card ──
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(18),
    padding: ms(14),
    marginBottom: ms(10),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    gap: ms(12),
  },
  emojiWrap: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(16),
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: ms(26),
  },
  emojiLocked: {
    opacity: 0.45,
  },
  checkBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ms(8),
  },
  cardTitle: {
    flex: 1,
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: colors.text,
  },
  lockedText: {
    color: colors.muted,
  },
  statusPill: {
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    borderRadius: ms(8),
  },
  statusPillText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(9),
    color: "#FFFFFF",
  },
  cardDesc: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(3),
    marginBottom: ms(9),
    lineHeight: ms(16),
  },
  progressTrack: {
    height: ms(7),
    backgroundColor: "#EEF1F5",
    borderRadius: ms(999),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: ms(999),
  },
  progressLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10),
    color: colors.textLight,
    marginTop: ms(6),
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: ms(52),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF0F4",
  },
});
