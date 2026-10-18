import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ads, BANNER_ID, useAds } from "../lib/ads";

// A non-personalized adaptive banner. Renders nothing until consent is settled,
// in Expo Go, or when there's no ad unit, and collapses if no ad fills.
export function AdBanner() {
  const { ready } = useAds();
  const [failed, setFailed] = useState(false);
  if (!ads || !ready || !BANNER_ID || failed) return null;
  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={BANNER_ID}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", alignItems: "center", overflow: "hidden", borderRadius: 12 },
});
