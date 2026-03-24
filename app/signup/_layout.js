import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { daysArr } from "@/constants/utils.js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { Button } from "../../components/ui/Button.js";

import { Logger } from "@/constants/Logger.js";
import { useRouter } from "expo-router";
import { Toast } from "toastify-react-native";
import InputText from "../../components/ui/InputText.js";
import MeasurementsStep from "../../components/ui/MeasurementStep.js";
import MultipleSelector from "../../components/ui/MultipleSelector.js";
import StepContainer from "../../components/ui/StepContainer.js";

import { useUser } from "@/constants/UserContext.js";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { OptionCardController } from "../../components/ui/OptionCard.js";
import SliderSelector from "../../components/ui/SliderSelector.js";
import { colors } from "../../constants/colors.js";
import { saveSession } from "../../constants/SessionManager";

export default function Signup() {
  const { t } = useTranslation();
  const router = useRouter();
  const totalSteps = 7;
  const [step, setStep] = useState(1);
  const progress = (step / totalSteps) * 100;

  const { user } = useUser();

  Logger.log("user--Signup-->", user);

  const schema = yup.object().shape({
    name: yup
      .string()
      .trim()
      .required("Name is required")
      .min(1, "Name cannot be empty"),

    gender: yup.string().trim().required("Gender is required"),

    age: yup
      .number()
      .typeError("Age is required")
      .required("Age is required")
      .min(10, "Too young")
      .max(100, "Invalid age"),

    height: yup
      .string()
      .trim()
      .required("Height is required")
      .min(1, "Height cannot be empty"),

    weight: yup
      .string()
      .trim()
      .required("Weight is required")
      .min(1, "Weight cannot be empty"),

    experience: yup.string().trim().required("Experience is required"),

    goal: yup.string().trim().required("Goal is required"),

    days: yup
      .array()
      .of(yup.string())
      .min(1, "Select at least one day")
      .required("Days are required"),

    time: yup.string().trim().required("Workout time is required"),
  });

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: user?.name || "",
      gender: user?.gender || "",
      age: user?.age || 20,
      height: user?.height || "",
      weight: user?.weight || "",
      experience: user?.experience || "",
      goal: user?.goal || "",
      days: user?.days || [],
      time: user?.time || "",
    },
  });

  const onSubmit = async (data) => {
    Logger.log("Form Data:", data);
    await saveSession(data);

    router.replace("/home");
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

    if (step < totalSteps) setStep(step + 1);
    else form.handleSubmit(onSubmit)();
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
          min={10}
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
    const times = [
      { value: "06:00", label: "🌅 Morning", time: "6-8 AM" },
      { value: "12:00", label: "🌞 Afternoon", time: "12-2 PM" },
      { value: "17:00", label: "🌆 Evening", time: "5-7 PM" },
      { value: "20:00", label: "🌙 Night", time: "8-10 PM" },
    ];
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
                time: "6-8 AM",
              },
              {
                emoji: "🌞",
                title: t("afternoon"),
                description: t("afternoonSub"),
                value: "12:00",
                time: "12-2 PM",
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
            unitHeight={"cm"}
            minWeight={30}
            maxWeight={170}
            unitWeight={"KG"}
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("signup.title")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("signup.step", { current: step, total: totalSteps })}
        </Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
    marginBottom: 32,
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
});
