import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ads, BANNER_ID, reportError, useAds } from "../lib/ads";
import { buyRemoveAds, canPurchase, usePurchases } from "../lib/purchases";
import { font, useTheme } from "../theme";

// A non-personalized adaptive banner. Renders nothing until consent is settled,
// in Expo Go, when there's no ad unit or ads were paid off, and collapses if no ad fills.
export function AdBanner() {
  const t = useTheme();
  const { ready } = useAds();
  const iap = usePurchases();
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  if (!ads || !ready || !BANNER_ID || failed || iap.adFree) return null;
  const { BannerAd, BannerAdSize } = ads;
  return (
    <View style={styles.outer}>
      {/* Size the ad to the space it has, not the full screen, so it isn't clipped by the screen's padding. */}
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
      {canPurchase && iap.price && (
        <Pressable accessibilityRole="button" onPress={buyRemoveAds} disabled={iap.busy} hitSlop={8}>
          <Text style={[styles.remove, { color: t.muted }]}>Remove ads for {iap.price}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: "stretch", alignItems: "center", gap: 6 },
  wrap: { alignSelf: "stretch", alignItems: "center", overflow: "hidden", borderRadius: 12 },
  remove: { fontSize: 13, fontFamily: font.bodySemi, textDecorationLine: "underline" },
});
