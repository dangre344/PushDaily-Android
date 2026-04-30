import { Ionicons, Octicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button.js";
import IconWithText from "../../components/ui/IconWithText";
import { colors } from "../../constants/colors";
import { workoutListGlobal } from "../../constants/Constants.js";
import { Logger } from "../../constants/Logger.js";
import { scaling } from "../../constants/useScaling.js";

export default function WorkoutListingScreen({ route }) {
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;

  const { selectedBodyPart } = useLocalSearchParams();
  const bodyPartObj = selectedBodyPart ? JSON.parse(selectedBodyPart) : null;

  console.log("Received bodyPart:", bodyPartObj);

  Logger.log("Received bodyPart in WorkoutListingScreen:", selectedBodyPart);

  const HEADER_MAX_HEIGHT = 250;
  const HEADER_MIN_HEIGHT = 90;
  const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  const { t } = useTranslation();
  const router = useRouter();

  const workouts = workoutListGlobal.find(
    (item) =>
      item.workoutId === bodyPartObj.id &&
      item.bodyPart === bodyPartObj.name &&
      item.level === bodyPartObj.level,
  );

  Logger.log("ReceivedImg----", workouts?.img);
  // Animation interpolations
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -50],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -100],
    extrapolate: "clamp",
  });

  const fixedHeaderOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE - 50, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const renderWorkoutItem = ({ item, index }) => (
    <View style={styles.workoutItem} activeOpacity={0.7}>
      <Image
        style={styles.workoutImage}
        source={item?.photo}
        resizeMode="contain"
      />
      <View style={styles.workoutInfo}>
        <Text style={styles.workoutName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.reps ? (
          <Text style={styles.workoutLevel}>{"x " + item.reps + " reps"}</Text>
        ) : (
          <View style={styles.workoutDetails}>
            <IconWithText
              icon={<Octicons name="clock" size={14} color="#666" />}
              label={item.time}
              size={12}
              textStyle={styles.detailText}
              orientation="horizontal"
            />
          </View>
        )}
        {/* <View style={styles.workoutDetails}>
          <IconWithText
            icon={<Octicons name="clock" size={14} color="#666" />}
            label={item.time}
            size={12}
            textStyle={styles.detailText}
            orientation="horizontal"
          />
          <IconWithText
            icon={<Icon name="flame-outline" size={32} color="white" />}
            label={`${item.calories} Cal`}
            size={12}
            textStyle={styles.detailText}
            orientation="horizontal"
          />
        </View> */}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[styles.fixedHeader, { opacity: fixedHeaderOpacity }]}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={{ marginBottom: 20 }}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{workouts.bodyPart}</Text>

              <View style={{ width: 40 }} />
            </View>

            <View style={styles.overlayMeta}>
              <Text
                style={[
                  styles.overlayLevel,
                  { color: "black", textShadowRadius: 0 },
                ]}
              >
                Level: {workouts.level}
              </Text>

              <Text style={styles.overlayCalories}>
                {workouts.calories} Kcal
              </Text>
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
              transform: [{ translateY: imageTranslateY }],
            },
          ]}
        />

        <SafeAreaView style={styles.imageOverlay}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.imageBackButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
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
          <Text style={styles.overlayTitle}>{workouts.bodyPart}</Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.overlayLevel}>Level: {workouts.level}</Text>
            <Text style={styles.overlayCalories}>{workouts.calories} Kcal</Text>
          </View>
        </Animated.View>
      </Animated.View>

      <FlatList
        data={workouts.workoutList}
        renderItem={renderWorkoutItem}
        ListHeaderComponent={
          <Text style={styles.totalWorkoutTitle}>
            {`Total Workouts: ${workouts.workoutList.length}`}
          </Text>
        }
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      <Button
        title={t("start")}
        style={{ paddingVertical: 20, marginHorizontal: 20, marginBottom: 10 }}
        onPress={() => {
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
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  safeArea: {
    backgroundColor: "#fff",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "OpenSans_700Bold",
    color: "#000",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  headerImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 0,
  },
  imageBackButton: {
    marginTop: 20,
    alignSelf: "flex-start",
  },
  titleOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  overlayTitle: {
    fontSize: 32,
    fontFamily: "OpenSans_700Bold",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 10,
  },
  overlayMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
  },
  overlayLevel: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "OpenSans_400Regular",

    textShadowRadius: 3,
  },
  overlayCalories: {
    fontSize: 14,
    color: colors.white,
    fontFamily: "OpenSans_500Medium",

    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    textShadowRadius: 3,
  },
  listContent: {
    paddingTop: scaling().scaleHeight(220), // Matches HEADER_MAX_HEIGHT
  },
  infoContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  bodyPartTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: "#000",
    marginBottom: 10,
  },
  metaInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelText: {
    fontSize: 14,
    color: "#555",
    fontFamily: "OpenSans_400Regular",
  },
  caloriesText: {
    fontSize: 14,
    color: colors.primary,

    fontFamily: "OpenSans_500Medium",
  },
  workoutItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  workoutImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  workoutInfo: {
    flex: 1,
    marginLeft: 15,
    marginRight: 10,
  },
  workoutName: {
    fontSize: scaling().moderateScale(16),

    fontFamily: "OpenSans_600SemiBold",
    color: "#000",
    marginBottom: 4,
  },

  totalWorkoutTitle: {
    fontSize: scaling().moderateScale(14),
    marginStart: 20,
    fontFamily: "OpenSans_600SemiBold",
    color: "#000",
    marginBottom: 4,
  },
  workoutLevel: {
    fontSize: scaling().moderateScale(16),
    color: "#000000",
    fontFamily: "OpenSans_500Medium",
    marginBottom: 8,
  },
  workoutDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  detailText: {
    fontSize: scaling().moderateScale(16),
    fontFamily: "OpenSans_500Medium",
    color: "#000000",
  },
});
