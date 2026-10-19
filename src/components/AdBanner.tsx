import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ads, BANNER_ID, reportError, useAds } from "../lib/ads";

// A non-personalized adaptive banner. Renders nothing until consent is settled,
// in Expo Go, or when there's no ad unit, and collapses if no ad fills.
export function AdBanner() {
  const { ready } = useAds();
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  if (!ads || !ready || !BANNER_ID || failed) return null;
  const { BannerAd, BannerAdSize } = ads;
  return (
    // Size the ad to the space it has, not the full screen, so it isn't clipped by the screen's padding.
    <View style={styles.wrap} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      {width > 0 && (
        <BannerAd
          unitId={BANNER_ID}
          size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
          width={width}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(e) => {
            reportError("banner", e);
            setFailed(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", alignItems: "center", overflow: "hidden", borderRadius: 12 },
});
