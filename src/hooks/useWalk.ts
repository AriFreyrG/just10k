import { useEffect, useReducer, useState } from "react";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { cumulative, planDetour, type LatLon, type PlannedRoute, type Router } from "../lib/loop";
import { watchSteps } from "../lib/steps";
import { WalkTracker } from "../lib/walk";

type Options = {
  route: PlannedRoute;
  home: LatLon;
  goalM: number;
  router: Router;
  // Replay the route at ~10x walking speed instead of using GPS (dev only).
  simulate?: boolean;
};

export function useWalk({ route, home, goalM, router, simulate = false }: Options) {
  const [tracker] = useState(() => new WalkTracker(route));
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [position, setPosition] = useState<LatLon | null>(null);
  const [pedometerSteps, setPedometerSteps] = useState<number | null>(null);
  const [replanning, setReplanning] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  useKeepAwake();

  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    const onFix = (pos: LatLon, accuracy: number) => {
      if (tracker.update(pos, accuracy)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setPosition(pos);
      rerender();
    };

    if (simulate) {
      const cum = cumulative(tracker.route.coords);
      let m = 0;
      let last = 0;
      const timer = setInterval(() => {
        m += 14;
        const coords = tracker.route.coords;
        const found = cum.findIndex((c) => c >= m);
        const i = found < 0 ? coords.length - 1 : found;
        // Pass through every route point on the way, so the odometer follows
        // the real path instead of cutting corners between fixes.
        for (let j = last + 1; j < i; j++) tracker.update(coords[j], 5);
        last = i;
        onFix(coords[i], 5);
        if (found < 0) clearInterval(timer);
      }, 1000);
      cleanups.push(() => clearInterval(timer));
    } else {
      (async () => {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return setGpsError("Location permission is off, so the walk can't be tracked.");
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
          (l) => onFix([l.coords.latitude, l.coords.longitude], l.coords.accuracy ?? 20)
        );
        if (cancelled) sub.remove();
        else cleanups.push(() => sub.remove());
        const stop = await watchSteps(setPedometerSteps);
        if (stop) {
          if (cancelled) stop();
          else cleanups.push(stop);
        }
      })();
    }
    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [tracker, simulate]);

  async function replan() {
    if (!tracker.lastPos) return;
    setReplanning(true);
    try {
      const next = await planDetour({
        from: tracker.lastPos,
        to: home,
        targetM: Math.max(200, goalM - tracker.odometerM),
        router,
      });
      tracker.setRoute(next);
      rerender();
    } finally {
      setReplanning(false);
    }
  }

  return { tracker, position, pedometerSteps, replan, replanning, gpsError };
}
