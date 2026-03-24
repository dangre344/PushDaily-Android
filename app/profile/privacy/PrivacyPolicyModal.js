import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../../../constants/colors";
import { scaling } from "../../../constants/useScaling";

const PRIVACY_SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "MyWorkout collects only the data you enter directly into the app — including workout sessions, exercise names, calories, body part targets, and difficulty levels. All data is stored locally on your device using SQLite and is never transmitted to external servers.",
  },
  {
    title: "2. How We Use Your Data",
    body: "Your data is used solely to display your workout history, progress statistics, and weekly attendance. We do not use your data for advertising, profiling, or any commercial purpose.",
  },
  {
    title: "3. Data Storage",
    body: "All workout data is stored locally on your device. We do not maintain any cloud database or remote storage of your personal fitness information. Uninstalling the app will permanently delete all stored data.",
  },
  {
    title: "4. Notifications",
    body: "If you grant notification permissions, MyWorkout may send local workout reminders. These are scheduled on-device and do not involve any external service or data transmission.",
  },
  {
    title: "5. Third-Party Services",
    body: "MyWorkout does not integrate with any third-party analytics, advertising SDKs, or tracking services. The app operates entirely offline.",
  },
  {
    title: "6. Children's Privacy",
    body: "MyWorkout is not directed at children under the age of 13. We do not knowingly collect data from minors.",
  },
  {
    title: "7. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. Any changes will be reflected within the app with an updated date shown above.",
  },
  {
    title: "8. Contact",
    body: "If you have any questions about this Privacy Policy, please contact us at support@myworkoutapp.com.",
  },
];

// ── Privacy Policy Modal component ──
export const PrivacyPolicyModal = ({ privacyVisible, setPrivacyVisible }) => (
  <Modal
    visible={privacyVisible}
    animationType="slide"
    transparent
    onRequestClose={() => setPrivacyVisible(false)}
  >
    <View style={modalStyles.overlay}>
      <View style={modalStyles.sheet}>
        {/* Handle bar */}
        <View style={modalStyles.handle} />

        {/* Header */}
        <View style={modalStyles.modalHeader}>
          <View style={modalStyles.modalIconWrap}>
            <Ionicons
              name="shield-checkmark"
              size={scaling().moderateScale(20)}
              color={colors.green}
            />
          </View>
          <Text style={modalStyles.modalTitle}>Privacy Policy</Text>
          <TouchableOpacity
            onPress={() => setPrivacyVisible(false)}
            style={modalStyles.closeBtn}
          >
            <Ionicons
              name="close"
              size={scaling().moderateScale(20)}
              color={colors.muted}
            />
          </TouchableOpacity>
        </View>

        <Text style={modalStyles.lastUpdated}>Last updated: March 2026</Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={modalStyles.scrollContent}
        >
          <View>
            {PRIVACY_SECTIONS.map((section) => (
              <View key={section.title} style={modalStyles.section}>
                <Text style={modalStyles.sectionTitle}>{section.title}</Text>
                <Text style={modalStyles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={modalStyles.acceptBtn}
          onPress={() => setPrivacyVisible(false)}
          activeOpacity={0.85}
        >
          <Text style={modalStyles.acceptText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: scaling().moderateScale(20),
    paddingBottom: scaling().moderateScale(36),
    maxHeight: "85%",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  handle: {
    width: scaling().moderateScale(36),
    height: scaling().moderateScale(4),
    borderRadius: scaling().moderateScale(2),
    backgroundColor: colors.dim,
    alignSelf: "center",
    marginTop: scaling().moderateScale(12),
    marginBottom: scaling().moderateScale(8),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaling().moderateScale(10),
    paddingVertical: scaling().moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: scaling().moderateScale(4),
  },
  modalIconWrap: {
    width: scaling().moderateScale(34),
    height: scaling().moderateScale(34),
    borderRadius: scaling().moderateScale(10),
    backgroundColor: colors.green + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(17),
    color: colors.text,
  },
  closeBtn: {
    width: scaling().moderateScale(32),
    height: scaling().moderateScale(32),
    borderRadius: scaling().moderateScale(16),
    backgroundColor: colors.textLight + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  lastUpdated: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(11),
    color: colors.muted,
    marginTop: scaling().moderateScale(8),
    marginBottom: scaling().moderateScale(4),
  },
  scrollContent: {
    paddingVertical: scaling().moderateScale(8),
  },
  section: {
    marginBottom: scaling().moderateScale(18),
  },
  sectionTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(13),
    color: colors.text,
    marginBottom: scaling().moderateScale(6),
  },
  sectionBody: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(13),
    color: colors.muted,
    lineHeight: scaling().moderateScale(20),
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: scaling().moderateScale(14),
    alignItems: "center",
    marginTop: scaling().moderateScale(12),
  },
  acceptText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(15),
    color: "#fff",
  },
});
