import { useEffect, useState } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Google AdMob, non-personalized only. The SDK has native code that Expo Go
// doesn't include, so load it only in real builds and do nothing elsewhere.
type Ads = typeof import("react-native-google-mobile-ads");

function load(): Ads | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // A plain import would crash Expo Go, which lacks the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-google-mobile-ads") as Ads;
  } catch {
    return null;
  }
}

export const ads = load();

// Real ad unit from AdMob, set at build time. Without one a release build shows no ads.
export const BANNER_ID: string | null = __DEV__
  ? (ads?.TestIds.ADAPTIVE_BANNER ?? null)
  : (process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS ?? null);

type State = {
  ready: boolean;
  privacyOptions: boolean;
  // Diagnostics for the Settings sheet, since TestFlight builds show no logs.
  consentStatus: string | null;
  gdprApplies: boolean | null;
  canRequestAds: boolean | null;
  lastError: string | null;
};
let state: State = { ready: false, privacyOptions: false, consentStatus: null, gdprApplies: null, canRequestAds: null, lastError: null };
const listeners = new Set<(s: State) => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
};

let started = false;
let initialized = false;

async function startSdk() {
  if (!ads || initialized) return;
  const info = await ads.AdsConsent.getConsentInfo();
  const gdprApplies = await ads.AdsConsent.getGdprApplies().catch(() => null);
  set({
    privacyOptions: info.privacyOptionsRequirementStatus === ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    consentStatus: info.status,
    gdprApplies,
    canRequestAds: info.canRequestAds,
  });
  if (!info.canRequestAds) return;
  initialized = true;
  await ads.default().initialize();
  set({ ready: true });
}

/**
 * Ask for consent where the law needs it (Google's UMP form, EEA and UK only),
 * then start the SDK. Safe to call more than once.
 */
export function startAds() {
  if (!ads || started) return;
  started = true;
  ads.AdsConsent.gatherConsent()
    .then(startSdk)
    // On an error, UMP still has the previous session's answer; try with that.
    .catch((e) => {
      reportError("consent", e);
      return startSdk();
    })
    .catch((e) => reportError("sdk", e));
}

/** Remember the latest ad or consent failure for the Settings sheet. */
export function reportError(where: string, e: unknown) {
  const err = e as { code?: string; message?: string };
  set({ lastError: `${where}: ${err?.code ?? err?.message ?? String(e)}` });
}

export async function showPrivacyChoices() {
  if (!ads) return;
  await ads.AdsConsent.showPrivacyOptionsForm();
  await startSdk();
}

export function useAds(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
