import { Ionicons, Octicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";

import { AD_UNIT_IDS } from "../../ads/Admobmanager.js";
import { Button } from "../../components/ui/Button.js";
import IconWithText from "../../components/ui/IconWithText";
import { colors } from "../../constants/colors";
import { workoutListGlobal } from "../../constants/Constants.js";
import { Logger } from "../../constants/Logger.js";
import { scaling } from "../../constants/useScaling.js";

const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function WorkoutListingScreen({ route }) {
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useTranslation();

  const [previewImage, setPreviewImage] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const imagePreviewOpacity = useRef(new Animated.Value(0)).current;
  const imagePreviewScale = useRef(new Animated.Value(0.85)).current;

  const scrollY = useRef(new Animated.Value(0)).current;

  const { selectedBodyPart } = useLocalSearchParams();
  const bodyPartObj = selectedBodyPart ? JSON.parse(selectedBodyPart) : null;

  Logger.log("Received bodyPart in WorkoutListingScreen:", selectedBodyPart);

  const HEADER_MAX_HEIGHT = moderateScale(250);
  const HEADER_MIN_HEIGHT = moderateScale(96);
  const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  const workouts = workoutListGlobal.find(
    (item) =>
      item.workoutId === bodyPartObj?.id &&
      item.bodyPart === bodyPartObj?.name &&
      item.level === bodyPartObj?.level,
  );

  if (!workouts) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.emptyBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.emptyTitle}>Workout not found</Text>
          <Text style={styles.emptySubtitle}>
            Please go back and select a workout again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const workoutCount = workouts?.workoutList?.length || 0;

  const totalReps = workouts?.workoutList?.reduce((sum, item) => {
    const reps = Number(item?.reps || 0);
    return sum + reps;
  }, 0);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE * 0.65, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.45, 0],
    extrapolate: "clamp",
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-80, 0, HEADER_SCROLL_DISTANCE],
    outputRange: [1.18, 1, 1.04],
    extrapolate: "clamp",
  });

  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -45],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE * 0.45, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.65, 0],
    extrapolate: "clamp",
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -55],
    extrapolate: "clamp",
  });

  const fixedHeaderOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE - 55, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const fixedHeaderTranslateY = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE - 60, HEADER_SCROLL_DISTANCE],
    outputRange: [-12, 0],
    extrapolate: "clamp",
  });

  const listTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -8],
    extrapolate: "clamp",
  });

  const handleStartWorkout = () => {
    Logger.log(
      "Navigating to WorkoutDetail with selectedBodyPart:",
      bodyPartObj?.id,
    );

    Logger.log(
      "Navigating to WorkoutDetail with bodyPartObj:",
      JSON.stringify({
        id: bodyPartObj?.id,
        name: bodyPartObj?.name,
        level: bodyPartObj?.level,
      }),
    );

    router.replace({
      pathname: "/workouts/workoutdetail",
      params: {
        id: bodyPartObj?.id,
        name: bodyPartObj?.name,
        level: bodyPartObj?.level,
      },
    });
  };

  const openImagePreview = (image, title) => {
    setPreviewImage(image);
    setPreviewTitle(title || "");

    imagePreviewOpacity.setValue(0);
    imagePreviewScale.setValue(0.85);

    Animated.parallel([
      Animated.timing(imagePreviewOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(imagePreviewScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeImagePreview = () => {
    Animated.parallel([
      Animated.timing(imagePreviewOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(imagePreviewScale, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPreviewImage(null);
      setPreviewTitle("");
    });
  };

  const renderWorkoutItem = ({ item, index }) => {
    const itemOpacity = scrollY.interpolate({
      inputRange: [
        0,
        HEADER_SCROLL_DISTANCE + index * 8,
        HEADER_SCROLL_DISTANCE + index * 8 + 80,
      ],
      outputRange: [1, 1, 1],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => openImagePreview(item?.photo, item?.name)}
      >
        <Animated.View
          style={[
            styles.workoutItem,
            {
              opacity: itemOpacity,
              transform: [{ translateY: listTranslateY }],
            },
          ]}
        >
          <View style={styles.workoutImageWrapper}>
            <Image
              style={styles.workoutImage}
              source={item?.photo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.workoutInfo}>
            <View style={styles.workoutTopRow}>
              <Text style={styles.workoutName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>

            {item.reps ? (
              <View style={styles.metaRow}>
                <View style={styles.softChip}>
                  <Text style={styles.softChipText}>x {item.reps} reps</Text>
                </View>
              </View>
            ) : (
              <View style={styles.workoutDetails}>
                <IconWithText
                  icon={
                    <Octicons name="clock" size={14} color={colors.primary} />
                  }
                  label={item.time}
                  size={12}
                  textStyle={styles.detailText}
                  orientation="horizontal"
                />
              </View>
            )}
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#C8CDD6"
            style={styles.chevron}
          />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeaderCard}>
      <View>
        <Text style={styles.totalWorkoutTitle}>{`Total Workouts`}</Text>
        <Text style={styles.totalWorkoutCount}>{workoutCount} exercises</Text>
      </View>

      <View style={styles.summaryRight}>
        <View style={styles.summaryPill}>
          <Ionicons name="flame-outline" size={16} color={colors.primary} />
          <Text style={styles.summaryPillText}>{workouts.calories} Kcal</Text>
        </View>

        {totalReps > 0 ? (
          <Text style={styles.totalRepsText}>{totalReps} total reps</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.fixedHeader,
          {
            opacity: fixedHeaderOpacity,
            transform: [{ translateY: fixedHeaderTranslateY }],
          },
        ]}
      >
        <SafeAreaView style={styles.fixedHeaderSafeArea} edges={["top"]}>
          <StatusBar
            barStyle="light-content"
            backgroundColor={colors.background}
          />
          <View style={styles.fixedHeaderContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.fixedBackButton}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.fixedTitleBlock}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {workouts.bodyPart}
              </Text>

              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {workouts.level} • {workoutCount} workouts
              </Text>
            </View>

            <View style={styles.fixedCaloriesBadge}>
              <Ionicons name="flame-outline" size={14} color="#FFFFFF" />
              <Text style={styles.fixedCaloriesText}>{workouts.calories}</Text>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <Animated.Image
          source={workouts?.img}
          style={[
            styles.headerImage,
            {
              opacity: imageOpacity,
              transform: [
                { translateY: imageTranslateY },
                { scale: imageScale },
              ],
            },
          ]}
        />

        <View style={styles.headerGradient} />

        <SafeAreaView style={styles.imageOverlay} edges={["top"]}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.background}
          />
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.imageBackButton}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={23} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>

        <Animated.View
          style={[
            styles.titleOverlay,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          <Text style={styles.overlayTitle} numberOfLines={2}>
            {workouts.bodyPart}
          </Text>

          <View style={styles.overlayMeta}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Level: {workouts.level}</Text>
            </View>

            <View style={styles.overlayCalories}>
              <Ionicons name="flame-outline" size={14} color="#FFFFFF" />
              <Text style={styles.overlayCaloriesText}>
                {workouts.calories} Kcal
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      <FlatList
        data={workouts.workoutList}
        renderItem={renderWorkoutItem}
        ListHeaderComponent={ListHeader}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: HEADER_MAX_HEIGHT },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomBar}>
        <Button
          title={t("start")}
          style={styles.startButton}
          onPress={handleStartWorkout}
        />

        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: false,
            }}
            onAdLoaded={() => {
              console.log("[AdMob] Banner loaded");
            }}
            onAdFailedToLoad={(error) => {
              console.warn("[AdMob] Banner failed:", error);
            }}
          />
        </View>
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="none"
        onRequestClose={closeImagePreview}
      >
        <Animated.View
          style={[
            styles.imagePreviewOverlay,
            {
              opacity: imagePreviewOpacity,
            },
          ]}
        >
          <Pressable
            style={styles.imagePreviewBackdrop}
            onPress={closeImagePreview}
          />

          <Animated.View
            style={[
              styles.imagePreviewCard,
              {
                transform: [{ scale: imagePreviewScale }],
              },
            ]}
          >
            <View style={styles.imagePreviewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.imagePreviewTitle} numberOfLines={1}>
                  {previewTitle}
                </Text>
                <Text style={styles.imagePreviewSubtitle}>
                  Exercise preview
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.imagePreviewClose}
                onPress={closeImagePreview}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.imagePreviewImageBox}>
              {previewImage ? (
                <Image
                  source={previewImage}
                  style={styles.imagePreviewImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <Text style={styles.imagePreviewHint}>
              Tap outside or press close to go back
            </Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  zoomBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  imagePreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  imagePreviewCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 20,
  },

  imagePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  imagePreviewTitle: {
    fontSize: 18,
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  imagePreviewSubtitle: {
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: 2,
  },

  imagePreviewClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  imagePreviewImageBox: {
    width: "100%",
    height: 360,
    borderRadius: 22,
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  imagePreviewImage: {
    width: "100%",
    height: "100%",
  },

  imagePreviewHint: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: 12,
  },

  emptyContainer: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
    justifyContent: "center",
    alignItems: "center",
  },

  emptyBackButton: {
    position: "absolute",
    top: moderateScale(16),
    left: moderateScale(16),
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },

  emptyTitle: {
    fontSize: moderateScale(22),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: moderateScale(8),
  },

  emptySubtitle: {
    fontSize: moderateScale(14),
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    textAlign: "center",
  },

  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 6,
  },

  fixedHeaderSafeArea: {
    backgroundColor: "#FFFFFF",
  },

  fixedHeaderContent: {
    minHeight: moderateScale(66),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(10),
    gap: moderateScale(12),
  },

  fixedBackButton: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(21),
    backgroundColor: "#F4F6F8",
    alignItems: "center",
    justifyContent: "center",
  },

  fixedTitleBlock: {
    flex: 1,
  },

  headerTitle: {
    fontSize: moderateScale(17),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  headerSubtitle: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: moderateScale(2),
  },

  fixedCaloriesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4),
    backgroundColor: colors.primary,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(999),
  },

  fixedCaloriesText: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: "#FFFFFF",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: 10,
    backgroundColor: colors.primary,
  },

  headerImage: {
    width: "100%",
    height: "100%",
  },

  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },

  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(18),
  },

  imageBackButton: {
    marginTop: moderateScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },

  titleOverlay: {
    position: "absolute",
    left: moderateScale(20),
    right: moderateScale(20),
    bottom: moderateScale(24),
  },

  levelBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999),
    marginBottom: moderateScale(10),
  },

  levelBadgeText: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: "#FFFFFF",
  },

  overlayTitle: {
    fontSize: moderateScale(34),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    lineHeight: moderateScale(40),
    marginBottom: moderateScale(14),
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  overlayMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(10),
  },

  overlayMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(999),
  },

  overlayMetaText: {
    fontSize: moderateScale(13),
    color: "#FFFFFF",
    fontFamily: "OpenSans_700Bold",
  },

  overlayCalories: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    backgroundColor: colors.primary,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999),
    marginBottom: moderateScale(10),
  },

  overlayCaloriesText: {
    fontSize: moderateScale(12),
    color: "#FFFFFF",
    fontFamily: "OpenSans_700Bold",
  },

  listContent: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(150),
  },

  listHeaderCard: {
    backgroundColor: "#FFFFFF",
    marginTop: moderateScale(20),

    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    marginBottom: moderateScale(14),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },

  totalWorkoutTitle: {
    fontSize: moderateScale(13),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
    marginBottom: moderateScale(3),
  },

  totalWorkoutCount: {
    fontSize: moderateScale(22),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  summaryRight: {
    alignItems: "flex-end",
    gap: moderateScale(6),
  },

  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(5),
    backgroundColor: colors.primary + "14",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(999),
  },

  summaryPillText: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
  },

  totalRepsText: {
    fontSize: moderateScale(11),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
  },

  workoutItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginBottom: moderateScale(12),
    padding: moderateScale(12),
    borderRadius: moderateScale(18),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  workoutImageWrapper: {
    width: moderateScale(76),
    height: moderateScale(76),
    borderRadius: moderateScale(18),
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  workoutImage: {
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: moderateScale(14),
  },

  workoutInfo: {
    flex: 1,
    marginLeft: moderateScale(14),
  },

  workoutTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },

  workoutName: {
    flex: 1,
    fontSize: moderateScale(15),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: moderateScale(6),
  },

  indexBadge: {
    width: moderateScale(25),
    height: moderateScale(25),
    borderRadius: moderateScale(13),
    backgroundColor: "#F1F3F7",
    alignItems: "center",
    justifyContent: "center",
  },

  indexText: {
    fontSize: moderateScale(11),
    fontFamily: "OpenSans_700Bold",
    color: colors.textLight,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  softChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(5),
    backgroundColor: colors.primary + "12",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999),
  },

  softChipText: {
    fontSize: moderateScale(13),
    color: colors.primary,
    fontFamily: "OpenSans_700Bold",
  },

  workoutDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(15),
  },

  detailText: {
    fontSize: moderateScale(13),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
  },

  chevron: {
    marginLeft: moderateScale(6),
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    paddingTop: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    borderTopWidth: 1,
    borderTopColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    elevation: 12,
  },

  startButton: {
    paddingVertical: moderateScale(17),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(8),
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: moderateScale(52),
  },
});
