import { Logger } from "@/constants/Logger";
import {
  AntDesign,
  Entypo,
  Feather,
  Ionicons,
  Octicons,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FemaleIcon } from "../../assets/AllSvgs";
import CircularImage from "../../components/ui/CircularImage";
import IconWithText from "../../components/ui/IconWithText";
import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";
import { getDay } from "../../constants/utils";
import HIITCard from "./Componenets/HIITCard";
import PopularItem from "./Componenets/PopularItem";
import WorkoutLevelModal from "./Componenets/WorkoutLevelModal";

const { width } = Dimensions.get("window");

const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const [openModal, setOpenModal] = useState(false);

  let bodyParts = [
    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Chest",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Shoulder",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Back",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Biceps",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Triceps",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Legs",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Upper Body",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Lower Body",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Abs",
    },

    {
      image: require("../../assets/images/chest.png"),
      bodyPart: "Neck",
    },
  ];

  let weeklyWorkouts = [
    {
      day: 0,
      isWorkout: true,
      workoutName: "Arms",
    },

    {
      day: 1,
      isWorkout: false,
      workoutName: "Chest",
    },

    {
      day: 2,
      isWorkout: false,
      workoutName: "Shoulder",
    },

    {
      day: 3,
      isWorkout: true,
      workoutName: "Lower Body",
    },

    {
      day: 4,
      isWorkout: true,
      workoutName: "Abs",
    },

    {
      day: 5,
      isWorkout: true,
      workoutName: "Legs",
    },

    {
      day: 6,
      isWorkout: false,
      workoutName: "Back",
    },
  ];

  let hiitWorkouts = [
    {
      name: "Full Body HIIT Blast",
      calories: 350,
      workoutSteps: [
        "Jumping Jacks - 40 sec",
        "High Knees - 30 sec",
        "Burpees - 20 sec",
        "Rest - 20 sec",
        "Mountain Climbers - 30 sec",
      ],
      time: "20 mins",
      exerciseLevel: "Intermediate",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",
    },
    {
      name: "Fat Burner HIIT",
      calories: 420,
      workoutSteps: [
        "Fast Squats - 45 sec",
        "Jump Lunges - 30 sec",
        "Burpees - 30 sec",
        "Plank Hold - 40 sec",
      ],
      time: "25 mins",
      exerciseLevel: "Advanced",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",
    },
    {
      name: "Beginner Cardio HIIT",
      calories: 210,
      workoutSteps: [
        "March on place - 1 min",
        "Side Steps - 40 sec",
        "Light Squats - 30 sec",
        "Rest - 30 sec",
      ],
      time: "15 mins",
      exerciseLevel: "Beginner",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",
    },
    {
      name: "Core HIIT Burner",
      calories: 315,
      workoutSteps: [
        "Plank - 45 sec",
        "Bicycle Crunches - 40 sec",
        "Leg Raises - 30 sec",
        "Sit Ups - 45 sec",
      ],
      time: "18 mins",
      exerciseLevel: "Intermediate",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",
    },
    {
      name: "Lower Body HIIT",
      calories: 330,
      workoutSteps: [
        "Squat Jump - 45 sec",
        "Lunges - 30 sec",
        "Glute Bridge - 40 sec",
        "Wall Sit - 30 sec",
      ],
      time: "22 mins",
      exerciseLevel: "Intermediate",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",
    },
  ];

  let popularWorkouts = [
    // BEGINNER
    {
      name: "Beginner Chest Burn",
      bodyPart: "Chest",
      calories: 180,
      time: "12 mins",
      level: "Beginner",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",

      workouts: [
        {
          workoutName: "Wall Pushups",
          reps: "12 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1022.jpg",
          steps: [
            "Stand one arm distance from wall",
            "Place palms on wall at chest height",
            "Slowly lean forward",
            "Push back to starting position",
          ],
        },
        {
          workoutName: "Knee Pushups",
          reps: "10 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1023.jpg",
          steps: [
            "Place knees on floor",
            "Hands shoulder width apart",
            "Lower chest to floor",
            "Push up and repeat",
          ],
        },
        {
          workoutName: "Rest",
          time: "20 sec",
          photo: "https://yavuzceliker.github.io/sample-images/image-1035.jpg",
          steps: ["Breathe slowly", "Stay relaxed"],
        },
      ],
    },

    // INTERMEDIATE
    {
      name: "Chest Pump",
      bodyPart: "Chest",
      calories: 300,
      time: "18 mins",
      level: "Intermediate",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",

      workouts: [
        {
          workoutName: "Push Ups",
          reps: "15 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1030.jpg",
          steps: [
            "Keep body straight",
            "Lower chest down",
            "Push up explosively",
          ],
        },
        {
          workoutName: "Decline Pushups",
          reps: "12 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1031.jpg",
          steps: [
            "Place feet on elevated surface",
            "Lower chest slowly",
            "Push up with control",
          ],
        },
        {
          workoutName: "Burpees",
          time: "30 sec",
          photo: "https://yavuzceliker.github.io/sample-images/image-1032.jpg",
          steps: [
            "Jump down to squat",
            "Kick legs back",
            "Pushup",
            "Jump back up",
          ],
        },
      ],
    },

    {
      name: "Core HIIT Burner",
      bodyPart: "Core",
      calories: 315,
      time: "18 mins",
      level: "Intermediate",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",

      workouts: [
        {
          workoutName: "Plank",
          time: "45 sec",
          photo: "https://yavuzceliker.github.io/sample-images/image-1040.jpg",
          steps: [
            "Keep elbows under shoulders",
            "Maintain straight body line",
            "Engage core",
          ],
        },
        {
          workoutName: "Bicycle Crunch",
          reps: "20 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1041.jpg",
          steps: ["Lift legs", "Twist torso", "Touch knee with opposite elbow"],
        },
        {
          workoutName: "Leg Raises",
          reps: "15 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1042.jpg",
          steps: [
            "Keep lower back pressed",
            "Lift legs slowly",
            "Lower without touching ground",
          ],
        },
      ],
    },

    // ADVANCED
    {
      name: "Advanced Chest Shredder",
      bodyPart: "Chest",
      calories: 450,
      time: "25 mins",
      level: "Advanced",
      photo: "https://yavuzceliker.github.io/sample-images/image-1021.jpg",

      workouts: [
        {
          workoutName: "Explosive Pushups",
          reps: "12 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1051.jpg",
          steps: [
            "Push up quickly",
            "Lift hands slightly off floor",
            "Land softly",
          ],
        },
        {
          workoutName: "Plyo Pushups",
          reps: "10 reps",
          photo: "https://yavuzceliker.github.io/sample-images/image-1052.jpg",
          steps: ["Drop chest fast", "Explode upward", "Repeat continuously"],
        },
        {
          workoutName: "Burpees",
          time: "40 sec",
          photo: "https://yavuzceliker.github.io/sample-images/image-1054.jpg",
          steps: ["Jump down", "Pushup", "Explode upward"],
        },
      ],
    },
  ];

  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          <FemaleIcon
            width={scaleWidth(40)}
            height={scaleHeight(40)}
            color={colors.primary}
          />

          <View>
            <Text style={styles.headerTitle}>
              {t("welcome", { name: "Gagan" })}
            </Text>

            <Text style={styles.subTitle}>Sore today, strong tomorrow.</Text>
          </View>
        </View>

        <View style={styles.calorieContainer}>
          <AntDesign name="fire" size={16} color={colors.primary} />
          <Text style={styles.streakTitle}>432</Text>
        </View>
      </View>

      <View
        style={{
          width: "100%",
          height: 0.2,
          backgroundColor: colors.textLight,
        }}
      />

      <ScrollView
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.workoutContainer}
      >
        <View>
          <View style={styles.weeklyAttContainer}>
            <View style={styles.weeklyAttTitles}>
              <Text style={styles.headerTitle}>{t("weeklyAttendance")}</Text>

              <IconWithText
                icon={<Octicons name="dot-fill" size={24} />}
                label="3 Days"
                size={16}
                textStyle={{ fontSize: moderateScale(10) }}
                color={colors.green}
                orientation="horizontal"
              />
            </View>

            <View style={styles.weekContainer}>
              {weeklyWorkouts.map((item) => {
                return (
                  <View style={styles.weekItem} key={item.day}>
                    <Text style={styles.weekTitle}>{getDay(item.day)}</Text>

                    {item.isWorkout ? (
                      <Octicons
                        name="check-circle-fill"
                        size={20}
                        color={colors.green}
                      />
                    ) : (
                      <Entypo
                        name="circle-with-cross"
                        size={20}
                        color={colors.errorRed}
                      />
                    )}

                    <Text
                      style={styles.workoutNameSub}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.isWorkout ? item.workoutName : "--"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.quickWorkoutContainer}>
            <Text style={styles.headerTitle}>{t("quickWorkouts")}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {bodyParts.map((item, index) => {
                return (
                  <Pressable
                    key={index}
                    onPress={() => {
                      Logger.log("Navigate to Workout Listing");

                      setOpenModal(true);
                    }}
                  >
                    <View style={styles.item} key={index}>
                      <CircularImage
                        source={item.image}
                        size={scaleHeight(80)}
                      />
                      <Text
                        style={styles.bodyPartName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.bodyPart}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ flexDirection: "row", marginTop: 15 }}>
            <Text style={styles.popularTitle}>{t("HIITWorkout")}</Text>
            <Ionicons name="fitness" size={20} color={colors.errorRed} />
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={hiitWorkouts}
            keyExtractor={(item, index) => `hiit-${item.id || index}`}
            renderItem={({ item }) => <HIITCard item={item} />}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            snapToInterval={scaleWidth(300)} // Card width + margin
            snapToAlignment="center"
            decelerationRate="fast"
            bounces={false}
            pagingEnabled={false} // Use snapToInterval instead
            getItemLayout={(data, index) => ({
              length: scaleWidth(300) + 20,
              offset: (scaleWidth(300) + 20) * index,
              index,
            })}
          />

          <View style={{ flexDirection: "row", marginTop: 15 }}>
            <Text style={styles.popularTitle}>{t("popularWorkouts")}</Text>
            <Feather name="trending-up" size={20} color={colors.green} />
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={popularWorkouts}
            keyExtractor={(item, index) => `hiit-${item.id || index}`}
            renderItem={({ item }) => <PopularItem item={item} />}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            snapToInterval={scaleWidth(300) - scaleWidth(25)} // Card width + margin
            snapToAlignment="center"
            decelerationRate="fast"
            bounces={false}
            pagingEnabled={false} // Use snapToInterval instead
            getItemLayout={(data, index) => ({
              length: scaleWidth(300) + 20,
              offset: (scaleWidth(300) + 20) * index,
              index,
            })}
          />
        </View>
      </ScrollView>

      {openModal ? (
        <WorkoutLevelModal
          visible={openModal}
          setOpenModal={setOpenModal}
          t={t}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  bodyPartName: {
    fontSize: 12,
    textAlign: "center",
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
    marginTop: 5,
  },

  attendanceContainer: {
    borderRadius: 10,
    borderWidth: 0.2,
    marginTop: 5,
    flexDirection: "row",

    paddingVertical: 10,
  },

  weeklyAttTitles: {
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  weeklyAttContainer: {
    marginTop: 5,
    alignContent: "center",
    justifyContent: "space-between",
  },

  quickWorkoutContainer: {
    marginTop: 15,
    gap: 10,

    alignContent: "center",
    justifyContent: "space-between",
  },

  nameContainer: {
    flexDirection: "row",
    gap: 10,
  },

  calorieContainer: {
    gap: 5,
    borderRadius: 20,
    borderWidth: 0.2,
    paddingVertical: 2,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,

    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  streakTitle: {
    fontSize: 12,
    fontFamily: "OpenSans_400Regular",
    color: colors.text,
    paddingVertical: 5,
  },

  weekContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    borderWidth: 0.2,
    borderRadius: 10,
    paddingVertical: 10,

    marginTop: 10,
  },

  workoutContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },

  weekItem: {
    flex: 1,
    alignItems: "center",
  },

  weekTitle: {
    fontSize: 13,

    color: "#222",
    marginBottom: 4,
  },

  subTitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },

  workoutNameSub: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  item: {
    marginEnd: 15,
  },

  hiitTitle: {
    marginTop: 15,
    fontSize: 15,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  popularTitle: {
    fontSize: 15,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginEnd: 10,
  },
});
