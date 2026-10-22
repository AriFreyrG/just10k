import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";

// "Remove ads": a one-time, non-consumable in-app purchase (StoreKit on iPhone,
// Play Billing on Android). Like the ads SDK, expo-iap has native code that
// Expo Go doesn't include, so load it only in real builds.
type Iap = typeof import("expo-iap");
type Purchase = import("expo-iap").Purchase;

function load(): Iap | null {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-iap") as Iap;
  } catch {
    return null;
  }
}

const iap = load();

// The same product ID in App Store Connect and the Play Console.
export const REMOVE_ADS_ID = "com.arifreyrg.just10k.removeads";

// Remembered on the phone so ads stay off offline and before the store answers.
const KEY = "just10k.adFree";

type State = {
  adFree: boolean;
  price: string | null; // localized, e.g. "$2.99"; null until the store answers
  busy: boolean;
  pending: boolean; // Ask to Buy or a slow payment method: waiting on approval
  message: string | null;
};
let state: State = { adFree: false, price: null, busy: false, pending: false, message: null };
const listeners = new Set<(s: State) => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
};

const owns = (p: Purchase) => p.productId === REMOVE_ADS_ID && p.purchaseState === "purchased";

async function grant() {
  set({ adFree: true, pending: false, busy: false, message: null });
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {}
}

/** Ask the store what's already owned, e.g. after a reinstall or on a new phone. */
async function syncOwned(): Promise<boolean> {
  if (!iap) return false;
  const purchases = await iap.getAvailablePurchases();
  const found = purchases.some(owns);
  if (found) await grant();
  return found;
}

let started = false;

/**
 * Read the remembered purchase, then connect to the store in the background
 * to fetch the price, hear about purchases and pick up ones already owned.
 * Resolves with whether ads are off, as soon as that's known locally.
 */
export async function startPurchases(): Promise<boolean> {
  if (started) return state.adFree;
  started = true;
  try {
    if ((await AsyncStorage.getItem(KEY)) === "1") set({ adFree: true });
  } catch {}
  if (iap) connect(iap).catch(() => {});
  return state.adFree;
}

async function connect(iap: Iap) {
  iap.purchaseUpdatedListener(async (p) => {
    if (p.productId !== REMOVE_ADS_ID) return;
    if (p.purchaseState === "pending") return set({ pending: true, busy: false, message: "Waiting for approval." });
    if (!owns(p)) return;
    await grant();
    await iap.finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
  });
  iap.purchaseErrorListener((e) => {
    if (e.code === iap.ErrorCode.AlreadyOwned) return void syncOwned().catch(() => {});
    set({ busy: false, message: iap.isUserCancelledError(e) ? null : "The purchase didn't go through. Try again later." });
  });
  await iap.initConnection();
  const products = await iap.fetchProducts({ skus: [REMOVE_ADS_ID], type: "in-app" });
  const product = products?.find((p) => p.id === REMOVE_ADS_ID);
  if (product) set({ price: product.displayPrice });
  await syncOwned();
}

export async function buyRemoveAds() {
  if (!iap || state.busy) return;
  set({ busy: true, message: null });
  try {
    // The result arrives through purchaseUpdatedListener / purchaseErrorListener.
    await iap.requestPurchase({
      request: { apple: { sku: REMOVE_ADS_ID }, google: { skus: [REMOVE_ADS_ID] } },
      type: "in-app",
    });
  } catch {
    set({ busy: false, message: "The store isn't available right now. Try again later." });
  }
}

export async function restoreRemoveAds() {
  if (!iap || state.busy) return;
  set({ busy: true, message: null });
  try {
    await iap.restorePurchases();
    if (!(await syncOwned())) set({ busy: false, message: "No earlier purchase found for this account." });
  } catch {
    set({ busy: false, message: "Couldn't reach the store. Try again later." });
  }
}

/** Whether the store can sell here at all (not in Expo Go). */
export const canPurchase = iap != null;

export function usePurchases(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
