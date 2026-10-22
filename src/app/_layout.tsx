import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { startAds } from "../lib/ads";
import { startPurchases } from "../lib/purchases";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  // Skip the ads SDK and its consent form entirely once ads are paid off.
  useEffect(() => {
    startPurchases().then((adFree) => {
      if (!adFree) startAds();
    });
  }, []);
  // On a font error, carry on with the system font rather than a blank screen.
  if (!loaded && !error) return null;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
