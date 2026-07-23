import { Ionicons } from "@expo/vector-icons";
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
                  },
                  {
                    emoji: "💪",
                    title: t("intermediate"),
                    description: t("intermediateSubWorkoutSelection"),
                  },
                  {
                    emoji: "🔥",
                    title: t("advanced"),
                    description: t("advancedSubWorkoutSelection"),
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
    backgroundColor: "#fff",
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
