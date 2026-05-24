import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";
import { AD_UNIT_IDS } from "../../../ads/Admobmanager";
import { colors } from "../../../constants/colors";
import { scaling } from "../../../constants/useScaling";

const PRIVACY_SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "Push Daily collects only the information you enter directly into the app. This may include your name, optional email address, age, gender, height, weight, workout experience, fitness goal, selected workout days, preferred workout time, workout sessions, exercise names, calories, body part targets, and difficulty levels.",
  },
  // {
  //   title: "2. Optional Email Address",
  //   body: "Providing an email address is optional. If you choose to provide it, we may use it to identify your profile, help with account or support requests, communicate important app-related or security updates, and improve your experience within the app. You can use the app without providing an email address.",
  // },
  {
    title: "2. How We Use Your Data",
    body: "Your data is used solely to personalize your workout experience, display your workout history, progress statistics, weekly attendance, reminders, and saved fitness preferences. We do not use your data for advertising, profiling, or selling to third parties.",
  },
  {
    title: "3. Data Storage",
    body: "Your workout and profile data is stored locally on your device using SQLite, unless a future version of the app clearly informs you about cloud-based features. Uninstalling the app may permanently delete locally stored data from your device.",
  },
  {
    title: "4. Notifications",
    body: "If you grant notification permissions, Push Daily may send workout reminders, progress reminders, or important app-related updates. Workout reminders are used only to help you stay consistent with your fitness routine.",
  },
  {
    title: "5. Third-Party Services",
    body: "Push Daily does not sell your personal information. If third-party services are added in the future, such as analytics, crash reporting, authentication, or cloud backup, this Privacy Policy will be updated to explain what data is shared and why.",
  },
  {
    title: "6. Children's Privacy",
    body: "Push Daily is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that such information has been collected, we will take reasonable steps to delete it.",
  },
  {
    title: "7. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. Any changes will be reflected within the app with an updated date shown above.",
  },

  {
    title: "8. Health Disclaimer",
    body: "Push Daily provides general fitness and workout guidance only. It is not medical advice. Please consult a healthcare professional before starting any new workout program, especially if you have any medical condition, injury, or health concern.",
  },
  {
    title: "9. Children's Privacy",
    body: "Push Daily is not directed at children under the age of 13. Users must be at least 13 years old to use the app because the app provides fitness and workout guidance that may not be suitable for younger children without parent or guardian supervision. We do not knowingly collect personal information from children under 13. If we become aware that such information has been collected, we will take reasonable steps to delete it.",
  },
  {
    title: "10. Contact",
    body: "If you have any questions about this Privacy Policy or your data, please contact us at supportflexicoach@gmail.com",
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
    <SafeAreaView style={modalStyles.overlay}>
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

        <View style={modalStyles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: false,
            }}
            onAdLoaded={() => {
              console.log("[AdMob] Banner loaded");
            }}
            onAdFailedToLoad={(error) => {
              console.warn("[AdMob] Banner failed:", error);
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  </Modal>
);

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    height: scaling().moderateScale(20),
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
