import { StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { AD_UNIT_IDS } from "./AdMobManager";

/**
 * BannerAdComponent
 *
 * Props:
 *   size         — BannerAdSize (default: ANCHORED_ADAPTIVE_BANNER)
 *   style        — extra ViewStyle
 *   onAdLoaded   — callback when ad loads
 *   onAdFailedToLoad — callback on error
 *
 * Usage:
 *   <BannerAdComponent size={BannerAdSize.MEDIUM_RECTANGLE} />
 */
const BannerAdComponent = ({
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  style,
  onAdLoaded,
  onAdFailedToLoad,
}) => {
  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={size}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={onAdLoaded}
        onAdFailedToLoad={onAdFailedToLoad}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
  },
});

export default BannerAdComponent;
