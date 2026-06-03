import { Ionicons } from "@expo/vector-icons";
import { nativeApplicationVersion } from "expo-application";
import {
  Modal,
  Platform,
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
import { Logger } from "../../../constants/Logger";
import { scaling } from "../../../constants/useScaling";

export const AboutModal = ({
  aboutVisible,
  setAboutVisible,
  handleRateApp,
  handleShareApp,
}) => (
  <Modal
    visible={aboutVisible}
    animationType="slide"
    transparent
    onRequestClose={() => setAboutVisible(false)}
  >
    <SafeAreaView style={aboutStyles.overlay}>
      <View style={aboutStyles.sheet}>
        <View style={aboutStyles.handle} />

        {/* Header */}
        <View style={aboutStyles.modalHeader}>
          <View
            style={[
              aboutStyles.modalIconWrap,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Ionicons
              name="barbell"
              size={scaling().moderateScale(20)}
              color={colors.primary}
            />
          </View>
          <Text style={aboutStyles.modalTitle}>About Push Daily</Text>
          <TouchableOpacity
            onPress={() => setAboutVisible(false)}
            style={aboutStyles.closeBtn}
          >
            <Ionicons
              name="close"
              size={scaling().moderateScale(20)}
              color={colors.muted}
            />
          </TouchableOpacity>
        </View>

        {/* App info + details (scrollable, banner stays pinned below) */}
        <ScrollView
          style={aboutStyles.scroll}
          contentContainerStyle={aboutStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={aboutStyles.infoCard}>
          <View style={aboutStyles.appIconWrap}>
            <Ionicons
              name="fitness"
              size={scaling().moderateScale(36)}
              color={colors.primary}
            />
          </View>
          <Text style={aboutStyles.appName}>Push Daily</Text>
          <Text style={aboutStyles.appVersion}>
            Version {nativeApplicationVersion ?? "1.0.0"}
            {"  •  "}
            Build {nativeApplicationVersion ?? "1"}
          </Text>
        </View>

        {/* Info rows */}
        {[
          { label: "Developer", value: "FlexiCoach Team" },
          {
            label: "Platform",
            value: Platform.OS === "ios" ? "iOS" : "Android",
          },
          { label: "Released", value: "May 2026" },
          { label: "Contact", value: "supportflexicoach@gmail.com" },
          //   { label: "Website", value: "www.myworkoutapp.com" },
        ].map((row) => (
          <View key={row.label} style={aboutStyles.row}>
            <Text style={aboutStyles.rowLabel}>{row.label}</Text>
            <Text style={aboutStyles.rowValue}>{row.value}</Text>
          </View>
        ))}

        {/* Action buttons */}
        <View style={aboutStyles.btnRow}>
          <TouchableOpacity
            style={[
              aboutStyles.btn,
              {
                backgroundColor: colors.primary + "18",
                borderColor: colors.primary + "44",
              },
            ]}
            onPress={() => {
              Logger.log("Rate app from About modal");

              handleRateApp();
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="star"
              size={scaling().moderateScale(15)}
              color={colors.primary}
            />
            <Text style={[aboutStyles.btnText, { color: colors.primary }]}>
              Rate Us
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              aboutStyles.btn,
              {
                backgroundColor: colors.blue + "18",
                borderColor: colors.blue + "44",
              },
            ]}
            onPress={() => {
              Logger.log("Share app from About modal");

              handleShareApp();
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="share-social"
              size={scaling().moderateScale(20)}
              color={colors.blue}
            />
            <Text style={[aboutStyles.btnText, { color: colors.blue }]}>
              Share
            </Text>
          </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={aboutStyles.bannerContainer}>
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

const aboutStyles = StyleSheet.create({
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
    paddingBottom: scaling().moderateScale(20),
    maxHeight: "88%",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  // flexShrink lets the content shrink within the sheet's maxHeight so it
  // scrolls, keeping the banner pinned at the bottom of the sheet.
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: scaling().moderateScale(4),
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
    backgroundColor: colors.primary + "20",
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
    backgroundColor: colors.grey,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    alignItems: "center",
    paddingVertical: scaling().moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: scaling().moderateScale(8),
  },
  appIconWrap: {
    width: scaling().moderateScale(72),
    height: scaling().moderateScale(72),
    borderRadius: scaling().moderateScale(20),
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaling().moderateScale(10),
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  appName: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(20),
    color: colors.text,
  },
  appVersion: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(12),
    color: colors.muted,
    marginTop: scaling().moderateScale(4),
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: scaling().moderateScale(11),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(13),
    color: colors.muted,
  },
  rowValue: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(13),
    color: colors.text,
  },
  btnRow: {
    flexDirection: "row",
    gap: scaling().moderateScale(10),
    marginTop: scaling().moderateScale(16),
    marginBottom: scaling().moderateScale(8),
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scaling().moderateScale(6),
    paddingVertical: scaling().moderateScale(12),
    borderRadius: scaling().moderateScale(12),
    borderWidth: 1,
    marginBottom: scaling().moderateScale(20),
  },
  btnText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(13),
  },
  copyright: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(11),
    color: colors.dim,
    textAlign: "center",
    marginTop: scaling().moderateScale(4),
  },
});
