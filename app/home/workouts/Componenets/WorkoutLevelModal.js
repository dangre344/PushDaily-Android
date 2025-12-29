import { useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OptionCardController } from "../../../../components/ui/OptionCard.js";
import { colors } from "../../../../constants/colors.js";

const WorkoutLevelModal = ({ visible, onClose, form, t }) => {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      experience: "",
    },
  });
  const router = useRouter();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
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

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              router.push("../../workouts/workoutlisting");
            }}
          >
            <Text style={styles.closeText}>{t("continue")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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

  title: {
    fontSize: 18,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
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
