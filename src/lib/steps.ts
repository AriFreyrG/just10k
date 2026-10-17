import { Platform } from "react-native";
import { Pedometer } from "expo-sensors";

// Steps the phone has counted since midnight. Only iOS exposes step history
// to apps without a Health Connect integration, so Android returns null and
// the user types their count in.
export async function stepsToday(): Promise<number | null> {
  if (Platform.OS !== "ios") return null;
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    const { granted } = await Pedometer.requestPermissionsAsync();
    if (!granted) return null;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const { steps } = await Pedometer.getStepCountAsync(midnight, new Date());
    return steps;
  } catch {
    return null;
  }
}

/** Live step count since subscribing; returns an unsubscribe function, or null. */
export async function watchSteps(onSteps: (steps: number) => void): Promise<(() => void) | null> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    const { granted } = await Pedometer.requestPermissionsAsync();
    if (!granted) return null;
    const sub = Pedometer.watchStepCount(({ steps }) => onSteps(steps));
    return () => sub.remove();
  } catch {
    return null;
  }
}
