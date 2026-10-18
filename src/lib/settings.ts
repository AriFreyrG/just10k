import AsyncStorage from "@react-native-async-storage/async-storage";

export type Settings = {
  goal: number;
  heightCm: number;
  strideCm: number | null; // overrides height when set
  doneToday: number; // manual entry / finished walks, reset each day
  doneDate: string;
};

const KEY = "just10k.settings";
export const today = () => new Date().toISOString().slice(0, 10);

export const DEFAULTS: Settings = {
  goal: 10000,
  heightCm: 170,
  strideCm: null,
  doneToday: 0,
  doneDate: today(),
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const s = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) } as Settings;
    if (s.doneDate !== today()) return { ...s, doneToday: 0, doneDate: today() };
    return s;
  } catch {
    return DEFAULTS;
  }
}

export async function saveSettings(s: Settings) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...s, doneDate: today() }));
  } catch {}
}
