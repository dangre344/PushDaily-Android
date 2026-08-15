import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";
import { openLevelPicker } from "../../constants/levelPicker";
import StatsScreen from "../stats/_layout";

const ms = (n) => scaling().moderateScale(n);

/**
 * Stats used to be a bottom tab (now replaced by Quiz). It lives in Profile
 * instead, opened as a full-screen sheet that reuses the existing StatsScreen.
 */
export default function StatsModal({ visible, setVisible }) {
  const navigation = useNavigation();

  // Empty state → close this sheet, then open the level picker for the body
  // part that was tapped. Routing has to wait for the Modal to actually close,
  // otherwise the next screen renders behind it.
  const openBodyPart = (item) => {
    setVisible(false);
    setTimeout(() => {
      navigation.navigate("Workouts");
      // A beat later so the tab is mounted before the picker opens.
      setTimeout(() => openLevelPicker(item), 250);
    }, 0);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setVisible(false)}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={ms(22)} color={colors.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Your Stats</Text>
            <Text style={styles.subtitle}>Progress, calories and insights</Text>
          </View>

          <View style={styles.iconWrap}>
            <Ionicons name="stats-chart" size={ms(18)} color={colors.primary} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <StatsScreen onPickBodyPart={openBodyPart} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: ms(12),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6EEF6",
  },
  backBtn: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(19),
    color: colors.text,
  },
  subtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(2),
  },
  iconWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
});
