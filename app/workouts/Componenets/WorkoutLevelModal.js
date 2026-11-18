import Ionicons from "@expo/vector-icons/Ionicons";
import { yupResolver } from "@hookform/resolvers/yup";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Yup from "yup";
import { Button } from "../../../components/ui/Button.js";
import { OptionCardController } from "../../../components/ui/OptionCard.js";
import { colors } from "../../../constants/colors.js";
import { workoutListGlobal } from "../../../constants/Constants.js";
import { Logger } from "../../../constants/Logger.js";
import { scaling } from "../../../constants/useScaling.js";

const WorkoutLevelModal = ({
  visible,
  onClose,
  form,
  t,
  setOpenModal,
  selectedBodyPart,
}) => {
  Logger.log(
    "WorkoutLevelModal rendered with selectedBodyPart:",
    selectedBodyPart,
  );

  const schema = Yup.object().shape({
    experience: Yup.string().required("Please select your experience level"),
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      experience: "",
    },
    resolver: yupResolver(schema),
  });

  // Preselect the level the user picked last time, so they don't have to
  // re-select it on every workout.
  useEffect(() => {
    AsyncStorage.getItem("last_workout_level")
      .then((saved) => {
        if (saved) setValue("experience", saved);
      })
      .catch(() => {});
  }, []);

  const selectedExperience = watch("experience");
  const router = useRouter();

  const exerciseCount = (level) =>
    workoutListGlobal.find(
      (plan) =>
        plan.bodyPart === selectedBodyPart?.bodyPart && plan.level === level,
    )?.workoutList?.length ?? 0;
  // Shown as a pill next to each level, e.g. "10 exercises".
  const countLabel = (level) => {
    const n = exerciseCount(level);
    return n ? `${n} ${n === 1 ? "exercise" : "exercises"}` : null;
  };

  function next(data) {
    Logger.log("next------>", data.experience);

    // Remember for next time (best-effort).
    AsyncStorage.setItem("last_workout_level", data.experience).catch(() => {});

    setOpenModal(false);

    router.push({
      pathname: "/workouts/workoutlisting",
      params: {
        selectedBodyPart: JSON.stringify({
          id: selectedBodyPart?.id,
          name: selectedBodyPart?.bodyPart,
          level: data.experience,
        }),
      },
    });
  }
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setOpenModal(false)}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.overlay}>
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.closeIcon}
              onPress={() => setOpenModal(false)}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>

            <Text style={styles.exTitle}>{selectedBodyPart.bodyPart}</Text>

            <Text style={styles.title}>{t("yourFitnessLevel")}</Text>
            <Text style={styles.subtitle}>{t("selectExpLevel")}</Text>
            {selectedBodyPart?.bodyPart === "Kegel Stamina" ? (
              <Text style={styles.healthNote}>
                Pregnant, postpartum or have pelvic pain? Check with a doctor first.
              </Text>
            ) : null}
            {selectedBodyPart?.bodyPart === "Pregnancy" ? (
              <Text style={styles.healthNote}>
                Check with your doctor before you start. Stop if you feel pain, dizziness, bleeding or contractions.
              </Text>
            ) : null}
            {selectedBodyPart?.bodyPart === "Post Pregnancy" ? (
              <Text style={styles.healthNote}>
                Start only after your doctor clears you (often around 6 weeks, longer after a C-section). Stop if you feel pain, heaviness or bleeding.
              </Text>
            ) : null}
            {selectedBodyPart?.bodyPart === "Neck Recovery" ? (
              <Text style={styles.healthNote}>
                Start with Basic. Move slowly and stay pain-free. See a doctor first after an accident, or if you have numbness, tingling or arm weakness.
              </Text>
            ) : null}

            <View style={styles.optionsContainer}>
              <OptionCardController
                control={control}
                name="experience"
                rules={{ required: "Please select your experience" }}
                defaultValue=""
                options={[
                  {
                    emoji: "🌱",
                    title: t("beginner"),
                    description: t("beginnerSubWorkoutSelection"),
                    badge: countLabel("Beginner"),
                  },
                  {
                    emoji: "💪",
                    title: t("intermediate"),
                    description: t("intermediateSubWorkoutSelection"),
                    badge: countLabel("Intermediate"),
                  },
                  {
                    emoji: "🔥",
                    title: t("advanced"),
                    description: t("advancedSubWorkoutSelection"),
                    badge: countLabel("Advanced"),
                  },
                ]}
              />
            </View>

            <Button
              title={t("continue")}
              onPress={() => {
                Logger.log("Continue pressed" + selectedExperience);

                if (!selectedExperience) {
                  Alert.alert("Select Experience", t("selectExperience"));

                  return;
                }
                handleSubmit(next)();
              }}
            />

            {/* <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              // router.push("../../workouts/workoutlisting");
            }}
          >
            <Text style={styles.closeText}>{t("continue")}</Text>
          </TouchableOpacity> */}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  healthNote: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 12,
    color: "#B45309",
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    textAlign: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },

  content: {
    backgroundColor: colors.card,
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  closeIcon: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    padding: 5,
  },

  title: {
    fontSize: scaling().moderateScale(15),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: 4,
  },

  exTitle: {
    fontSize: scaling().moderateScale(20),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 12,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
  },

  optionsContainer: {
    marginTop: 16,
    marginBottom: 20,
  },

  closeBtn: {
    backgroundColor: "#111",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },

  closeText: {
    color: colors.white,
    textAlign: "center",

    fontFamily: "OpenSans_700Bold",
  },
});

export default WorkoutLevelModal;
