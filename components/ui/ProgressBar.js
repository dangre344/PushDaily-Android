import { StyleSheet, View } from "react-native";

export default function ProgressBarComp({
  current = 0,
  total = 1,
  height = 6,
  backgroundColor = "#E5E7EB",
  progressColor = "#2563EB",
}) {
  const progress = Math.min(current / total, 1) * 100;

  return (
    <View style={[styles.container, { height, backgroundColor }]}>
      <View
        style={[
          styles.progress,
          {
            width: `${progress}%`,
            backgroundColor: progressColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 100,
    overflow: "hidden",
  },
  progress: {
    height: "100%",
    borderRadius: 100,
  },
});
