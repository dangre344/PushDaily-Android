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

// Short in-app summary of docs/privacy-policy.md — keep the two in sync.
const PRIVACY_SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "Your profile: name, gender, age, height, weight, fitness level, goal, workout days and reminder time. Health and fitness data you log: workouts, water intake and (optionally) period dates. Usage data collected automatically: device type, app version, screens and features used, crash reports, and how you found the app. We never ask for your email, phone number or password.",
  },
  {
    title: "2. Data That Stays On Your Phone",
    body: "Period tracking (start dates, cycle length, delay history), workout history and water intake are stored only on your device. Period data is never uploaded to our servers, never sent to analytics and never shared with anyone. Camera images used to count push-ups are processed on your device in real time and are never recorded or uploaded.",
  },
  {
    title: "3. Data That Leaves Your Phone",
    body: "• Analytics (Mixpanel): app usage and your profile details, including height, weight, age and gender.\n• AI trainer (Google Gemini / Groq via our server): your chat messages, profile details and, if you ask for a progress review, a workout summary. Never period data.\n• Food scanner: a nutrition-label photo is sent to our AI service to read it, and is not kept. Barcodes are looked up in Open Food Facts.\n• Push-up leaderboard: your display name, push-up count and country are stored and shown publicly to other users.\n• Firebase: crash reports and the notification token.",
  },
  {
    title: "4. Advertising",
    body: "The app shows ads through Google AdMob, which may use your device's advertising ID to show personalized ads. You can reset it or opt out in Android Settings → Google → Ads. Health data, including period data, is never shared with advertisers.",
  },
  {
    title: "5. Notifications",
    body: "With your permission we send workout, water and period reminders and daily fitness updates. Period reminders are scheduled on your device and never show dates or cycle details on your lock screen. Turn them off in the app or in your device settings.",
  },
  {
    title: "6. Payments",
    body: "Buy Me a Coffee contributions are optional and are handled by your UPI app or by Buy Me a Coffee on their secure pages. We never see or store card details, UPI PINs or bank details.",
  },
  {
    title: "7. We Do Not Sell Your Data",
    body: "We do not sell your personal data. We share it only with the service providers above, for the purposes described, or when required by law.",
  },
  {
    title: "8. Deleting Your Data",
    body: "Delete period entries in Period Tracking. Clear all on-device data via Settings → Apps → Push Daily → Storage → Clear data, or by uninstalling. To delete leaderboard scores or analytics data, email us with your profile name — we respond within 30 days.",
  },
  {
    title: "9. Health Disclaimer",
    body: "Push Daily provides general fitness guidance only. Period predictions are estimates, not medical advice or contraception. Please consult a healthcare professional about any health concern, and before starting a new workout program.",
  },
  {
    title: "10. Children's Privacy",
    body: "Push Daily is not intended for children under 13. We do not knowingly collect data from children under 13; if we learn that we have, we will delete it.",
  },
  {
    title: "11. Changes & Contact",
    body: "We may update this policy; changes appear here with a new date. Questions or data requests: supportflexicoach@gmail.com",
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

        <Text style={modalStyles.lastUpdated}>Last updated: October 2026</Text>

        <ScrollView
          style={modalStyles.scroll}
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
    minHeight: scaling().moderateScale(52),
    marginTop: scaling().moderateScale(8),
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
  // flexShrink lets the list shrink within the sheet's maxHeight so it scrolls,
  // keeping the "Got it" button and banner pinned at the bottom of the sheet.
  scroll: {
    flexShrink: 1,
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
