import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createUniqueId, daysArr } from "@/constants/utils.js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button } from "../../components/ui/Button.js";

import { Logger } from "@/constants/Logger.js";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Toast } from "toastify-react-native";
import InputText from "../../components/ui/InputText.js";
import MeasurementsStep from "../../components/ui/MeasurementStep.js";
import MultipleSelector from "../../components/ui/MultipleSelector.js";
import StepContainer from "../../components/ui/StepContainer.js";
import { trackEvent } from "../../constants/mixpanel.js";

import { useUser } from "@/constants/UserContext.js";
import { yupResolver } from "@hookform/resolvers/yup";

import * as Notifications from "expo-notifications";

import { scaling } from "@/constants/useScaling.js";
import { Ionicons } from "@expo/vector-icons";
import * as yup from "yup";
import { OptionCardController } from "../../components/ui/OptionCard.js";
import SliderSelector from "../../components/ui/SliderSelector.js";
import { colors } from "../../constants/colors.js";

export default function Signup() {
  const { from } = useLocalSearchParams();

  const isEditMode = from === "edit";

  Logger.log("Signup screen - isEditMode:", isEditMode);
  const [updateSuccessVisible, setUpdateSuccessVisible] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();
  const totalSteps = 7;
  const [step, setStep] = useState(1);
  const progress = (step / totalSteps) * 100;

  const { user, updateUser } = useUser();

  Logger.log("user--Signup-->", user);

  const schema = yup.object().shape({
    name: yup
      .string()
      .trim()
      .required("Name is required")
      .min(1, "Name cannot be empty"),

    // email: yup.string().trim().email("Enter a valid email").notRequired(),

    gender: yup.string().trim().required("Gender is required"),

    age: yup
      .number()
      .typeError("Age is required")
      .required("Age is required")
      .min(10, "Too young")
      .max(100, "Invalid age"),

    height: yup
      .number()
      .typeError("Height is required")
      .required("Height is required")
      .min(120, "Height is too low")
      .max(240, "Height is too high"),

    heightFeet: yup
      .number()
      .typeError("Height feet is required")
      .required("Height feet is required")
      .min(3, "Invalid height")
      .max(8, "Invalid height"),

    heightInches: yup
      .number()
      .typeError("Height inches is required")
      .required("Height inches is required")
      .min(0, "Invalid inches")
      .max(11, "Invalid inches"),

    weight: yup
      .number()
      .typeError("Weight is required")
      .required("Weight is required")
      .min(30, "Weight is too low")
      .max(170, "Weight is too high"),

    weightLbs: yup
      .number()
      .typeError("Weight lbs is required")
      .required("Weight lbs is required")
      .min(66, "Weight is too low")
      .max(375, "Weight is too high"),

    experience: yup.string().trim().required("Experience is required"),

    goal: yup.string().trim().required("Goal is required"),

    days: yup
      .array()
      .of(yup.string())
      .min(1, "Select at least one day")
      .required("Days are required"),

    time: yup.string().trim().required("Workout time is required"),
  });

  useEffect(() => {
    const setupNotificationChannel = async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
        });
      }
    };

    setupNotificationChannel();
  }, []);

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: user?.name || "",
      gender: user?.gender || "",
      age: user?.age || 20,
      // email: user?.email || "",

      // saved values
      height: user?.height || 140, // cm
      heightFeet: user?.heightFeet || "",
      heightInches: user?.heightInches || "",

      weight: user?.weight || 65, // kg
      weightLbs: user?.weightLbs || "",

      experience: user?.experience || "",
      goal: user?.goal || "",
      days: user?.days || [],
      time: user?.time || "",
    },
  });

  // Logger.log("form email--->", user?.email);

  const onSubmit = async (data) => {
    Logger.log("Form Data:", data);

    const userId = createUniqueId();

    const userData = {
      ...data,
      _id: userId,
    };

    Logger.log("Generated user ID:", userData);

    if (isEditMode) {
      // update existing profile
      await trackEvent("Update", {
        ...userData,
        _id: userId,
      });

      await updateUser(userData);

      setUpdateSuccessVisible(true);
      return;
    } else {
      await trackEvent("Signup Completed", {
        ...userData,
        _id: userId,
      });

      await updateUser(userData);

      router.replace("/home");
    }
  };

  const getNotificationTime = (time) => {
    // return { hour: 16, minute: 26 };
    Logger.log("Selected time for notification:", time);
    switch (time) {
      case "Morning":
        return { hour: 6, minute: 0 };

      case "Afternoon":
        return { hour: 12, minute: 0 };

      case "Evening":
        return { hour: 17, minute: 0 };

      case "Night":
        return { hour: 20, minute: 0 };

      default:
        return null;
    }
  };

  const requestNotificationPermission = async () => {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  };

  const scheduleNotification = async (timeValue) => {
    const notificationTime = getNotificationTime(timeValue);
    if (!notificationTime) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const reminderMinute = notificationTime.minute - 15;
    const reminderHour =
      reminderMinute < 0 ? notificationTime.hour - 1 : notificationTime.hour;
    const adjustedMinute =
      reminderMinute < 0 ? reminderMinute + 60 : reminderMinute;

    const allContent = [
      {
        reminder: {
          title: "Sunday Prep 🌅",
          body: "Get ready! Workout in 15 minutes. Start the week strong!",
        },
        start: {
          title: "Start the Week Strong 💪",
          body: "Sunday sets the tone. Let's crush it!",
        },
      },
      {
        reminder: {
          title: "Monday Motivation 🔥",
          body: "15 minutes to go! Time to make Monday count.",
        },
        start: {
          title: "New Week, New Goals 🚀",
          body: "Monday energy is unmatched. Let's go!",
        },
      },
      {
        reminder: {
          title: "Keep It Going 💥",
          body: "Workout in 15 minutes. You showed up yesterday — do it again!",
        },
        start: {
          title: "Tuesday Grind 🏋️",
          body: "Two days in. Consistency is building. Keep pushing!",
        },
      },
      {
        reminder: {
          title: "Midweek Check-In ⚡",
          body: "Halfway through the week! Workout starts in 15 minutes.",
        },
        start: {
          title: "Hump Day Hustle 💦",
          body: "Wednesday warrior. You're halfway there — finish strong!",
        },
      },
      {
        reminder: {
          title: "Almost Friday 🎯",
          body: "One more push! Your workout begins in 15 minutes.",
        },
        start: {
          title: "Thursday Power 🏃",
          body: "Don't stop now — the weekend is almost here. Give it everything!",
        },
      },
      {
        reminder: {
          title: "Friday Finisher 🙌",
          body: "End the week right! Workout starts in 15 minutes.",
        },
        start: {
          title: "Finish the Week Strong 🔥",
          body: "Friday energy hits different. Make this one count!",
        },
      },
      {
        reminder: {
          title: "Weekend Warrior 🏆",
          body: "No rest for the committed! Workout in 15 minutes.",
        },
        start: {
          title: "Saturday Sweat Session 💪",
          body: "Champions train on weekends too. Let's get it!",
        },
      },
    ];

    // Schedule one WEEKLY notification per day — 7 reminders + 7 starts = 14 total
    for (let weekday = 0; weekday <= 6; weekday++) {
      const content = allContent[weekday];

      await Notifications.scheduleNotificationAsync({
        content: {
          title: content.reminder.title,
          body: content.reminder.body,
          sound: true,
          vibrate: [0, 250, 250, 250],
          autoDismiss: true,
          data: { screen: "Home" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1, // expo-notifications: 1 = Sunday, 7 = Saturday
          hour: reminderHour,
          minute: adjustedMinute,
        },
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: content.start.title,
          body: content.start.body,
          sound: true,
          vibrate: [0, 250, 250, 250],
          autoDismiss: true,
          data: { screen: "Home" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1,
          hour: notificationTime.hour,
          minute: notificationTime.minute,
        },
      });
    }

    Logger.log(
      "[Notifications] Scheduled 14 weekly notifications (7 days × 2)",
    );
  };

  const submitForm = () => {
    Logger.log(" totalSteps:", form?.formState?.errors);
    Logger.log("getValues:--->", form.getValues());
    form.handleSubmit(onSubmit)();
  };

  const askNotificationPopup = async () => {
    const alreadyGranted = await requestNotificationPermission();

    if (alreadyGranted) {
      await scheduleNotification(form.getValues("time"));
      submitForm();
      return;
    }

    Alert.alert(
      "Never miss your notification",
      "Allow notifications so we can remind you at your selected time.",
      [
        {
          text: "Later",
          style: "cancel",
          onPress: submitForm,
        },
        {
          text: "Yes",
          onPress: async () => {
            const granted = await requestNotificationPermission();

            Logger.log("Notification permission granted:", granted);
            if (granted) {
              await scheduleNotification(form.getValues("time"));
            }

            submitForm();
          },
        },
      ],
    );
  };

  const nextStep = () => {
    Logger.log("gender---->" + form.getValues("gender"));
    if (step == 1 && form.getValues("gender") == "") {
      Toast.error(t("selectGender"), "top");
      return;
    } else if (step == 2 && form.getValues("name") == "") {
      Toast.error(t("enterName"), "top");
      return;
    } else if (step == 2 && form.getValues("age") == 0) {
      Toast.error(t("selectAge"), "top");
      return;
    } else if (step == 4 && form.getValues("experience") == "") {
      Toast.error(t("selectExp"), "top");
      return;
    } else if (step == 5 && form.getValues("goal") == "") {
      Toast.error(t("selectGoal"), "top");
      return;
    } else if (step == 6 && form.getValues("days") == "") {
      Toast.error(t("selectDays"), "top");
      return;
    } else if (step == 7 && form.getValues("time") == "") {
      Toast.error(t("selectTime"), "top");
      return;
    }

    Logger.log(" step:", step);
    Logger.log(" totalSteps:", totalSteps);

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      askNotificationPopup();
    }
  };

  const prevStep = () => step > 1 && setStep(step - 1);

  const toggleDay = (day) => {
    const current = form.days || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    form.setValue("days", updated);
  };

  // Each step as component:
  const GenderStep = () => {
    const { t } = useTranslation();

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t("signup.gender_title")}</Text>
        <Text style={styles.stepSubtitle}>{t("signup.gender_subtitle")}</Text>

        <View style={styles.optionsContainer}>
          <OptionCardController
            control={form.control}
            name="gender"
            rules={{ required: "Please select a gender" }}
            defaultValue={form.getValues("gender")}
            options={[
              { emoji: "🚹", title: "Male" },
              { emoji: "🚺", title: "Female" },
              { emoji: "⚧", title: "Other" },
            ]}
          />
        </View>
      </View>
    );
  };

  const AgeStep = () => {
    const { t } = useTranslation();

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t("signup.age_title")}</Text>
        <Text style={styles.stepSubtitle}>{t("signup.age_subtitle")}</Text>

        <SliderSelector
          control={form.control}
          name="age"
          label={t("selectAge")}
          min={13}
          defaultValue={form.getValues("age")}
          max={80}
          rules={{ required: "Please select your age" }}
          units={t("years")}
        />

        <InputText
          form={form}
          isOptional={false}
          titleTextLabel={t("enterName")}
          fieldName={"name"}
          inputType="text"
          placeholder={t("enterName")}
        />

        {/* <InputText
          form={form}
          isOptional={true}
          titleTextLabel={t("enterEmail")}
          fieldName="email"
          inputType="text"
          placeholder={t("enterEmail")}
          rootContainer={styles.inputMargin}
          keyboardType="email-address"
          autoCapitalize="none"
        /> */}
      </View>
    );
  };

  const ExperienceStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t("yourFitnessLevel")}</Text>
      <Text style={styles.stepSubtitle}>{t("yourFitnessLevelSub")}</Text>
      <View style={styles.optionsContainer}>
        <OptionCardController
          control={form.control}
          name="experience"
          rules={{ required: "Please select your experience" }}
          defaultValue=""
          options={[
            {
              emoji: "🌱",
              title: t("beginner"),
              description: t("beginnerSub"),
            },
            {
              emoji: "💪",
              title: t("intermediate"),
              description: t("intermediateSub"),
            },
            {
              emoji: "🔥",
              title: t("advanced"),
              description: t("advancedSub"),
            },
          ]}
        />
      </View>
    </View>
  );

  const GoalStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t("whatsMainGoal")}</Text>
      <Text style={styles.stepSubtitle}>{t("whatsMainGoalSub")}</Text>
      <View style={styles.optionsContainer}>
        <OptionCardController
          control={form.control}
          name="goal"
          rules={{ required: "Please select your expereince" }}
          defaultValue=""
          options={[
            {
              emoji: "🎯",
              title: t("loseWeight"),
              description: t("loseWeightSub"),
              value: "weight-loss",
            },
            {
              emoji: "💪",
              title: t("buildMuscle"),
              description: t("buildMuscleSub"),
              value: "muscle",
            },
            {
              emoji: "🧘",
              title: t("stayFlexible"),
              description: t("stayFlexibleSub"),
              value: "flexibility",
            },
            {
              emoji: "❤️",
              title: t("generalFitness"),
              description: t("generalFitnessSub"),
              value: "fitness",
            },
          ]}
        />
      </View>
    </View>
  );

  const DaysStep = () => {
    const { t } = useTranslation();
    const days = daysArr(t);
    const options = [
      t("Mon"),
      t("Tue"),
      t("Wed"),
      t("Thu"),
      t("Fri"),
      t("Sat"),
      t("Sun"),
    ];
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t("whichDays")}</Text>
        <Text style={styles.stepSubtitle}>{t("selectDays")}</Text>

        <MultipleSelector
          form={form}
          options={options}
          name="days"
          defaultValues={["Mon", "Tue"]}
        />
      </View>
    );
  };

  const TimeStep = () => {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Preferred workout time?</Text>
        <Text style={styles.stepSubtitle}>When do you usually workout?</Text>
        <View style={styles.optionsContainer}>
          <OptionCardController
            control={form.control}
            name="time"
            rules={{ required: "Please select your expereince" }}
            defaultValue=""
            options={[
              {
                emoji: "🌅",
                title: t("morning"),
                description: t("morningSub"),
                value: "06:00",
                time: "6-10 AM",
              },
              {
                emoji: "🌞",
                title: t("afternoon"),
                description: t("afternoonSub"),
                value: "12:00",
                time: "12-4 PM",
              },
              {
                emoji: "🌆",
                title: t("evening"),
                description: t("eveningSub"),
                value: "17:00",
                time: "5-7 PM",
              },
              {
                emoji: "🌙",
                title: t("night"),
                description: t("nightSub"),
                value: "20:00",
                time: "8-10 PM",
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderStep = () => {
    console.log("renderStep---->" + step);
    switch (step) {
      case 1:
        return <GenderStep form={form} />;
      case 2:
        return <AgeStep />;
      case 3:
        return (
          <MeasurementsStep
            form={form}
            minHeight={120}
            maxHeight={240}
            unitHeight="cm"
            minWeight={30}
            maxWeight={170}
            unitWeight="kg"
            selectedWeight={form.getValues("weight")}
            selectedHeight={form.getValues("height")}
          />
        );
      case 4:
        return <ExperienceStep />;
      case 5:
        return <GoalStep />;
      case 6:
        return <DaysStep />;
      case 7:
        return <TimeStep />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("signup.title")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("signup.step", { current: step, total: totalSteps })}
        </Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <StepContainer step={step}>
            {step === 1 && <GenderStep form={form} />}
            {step === 2 && <AgeStep form={form} />}
            {step === 3 && <MeasurementsStep form={form} />}
            {step === 4 && <ExperienceStep form={form} />}
            {step === 5 && <GoalStep form={form} />}
            {step === 6 && <DaysStep form={form} />}
            {step === 7 && <TimeStep form={form} />}
          </StepContainer>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            {step > 1 && (
              <Button
                title={t("signup.back")}
                style={{ flex: 1, marginEnd: 15 }}
                onPress={prevStep}
                variant="outline"
              />
            )}

            <Button
              title={
                step === totalSteps ? t("signup.finish") : t("signup.continue")
              }
              style={{ flex: 1 }}
              onPress={nextStep}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={updateSuccessVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setUpdateSuccessVisible(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons
                name="checkmark-circle"
                size={scaling().moderateScale(36)}
                color={colors.primary}
              />
            </View>

            <Text style={styles.successTitle}>Updated Successfully</Text>

            <Text style={styles.successMessage}>
              Your data has been updated.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.successButton}
              onPress={() => {
                setUpdateSuccessVisible(false);
                router.back();
              }}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    marginTop: 4,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    marginBottom: 10,
  },
  optionsContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
    marginBottom: 8,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    marginTop: 8,
  },
  dayButton: {
    flex: 1,
    minWidth: "28%",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
  },

  inputMargin: {
    marginTop: 15,
    marginBottom: 5,
  },
  dayButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
  },
  dayTextSelected: {
    color: colors.white,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: "center",
  },
  quickButtonText: {
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  skipText: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
  },

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  successCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 8,
  },

  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  successTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 20,
    color: colors.text,
    textAlign: "center",
  },

  successMessage: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 14,
    color: colors.textLight || "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  successButton: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  successButtonText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
