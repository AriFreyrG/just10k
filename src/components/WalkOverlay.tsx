import { useEffect, useRef } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useWalk } from "../hooks/useWalk";
import { metersToSteps, stepsToMeters, type LatLon, type PlannedRoute, type Router } from "../lib/loop";
import { fmt, font, km, useTheme } from "../theme";
import { Button, TurnIcon } from "./ui";

type Props = {
  route: PlannedRoute;
  home: LatLon;
  goalSteps: number;
  doneBefore: number;
  strideM: number;
  router: Router;
  simulate: boolean;
  // Route (it changes on a re-plan), how far along it you are, and where you are.
  onProgress: (route: PlannedRoute, index: number, pos: LatLon | null) => void;
  onFinish: (steps: number, meters: number) => void;
  onSheetLayout: (e: LayoutChangeEvent) => void;
};

const HOME_STRETCH_M = 300;
const dist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${km(m)} km`);

// 3 · Walking: drawn over the map.
export function WalkOverlay(p: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const goalM = stepsToMeters(p.goalSteps, p.strideM);
  const walk = useWalk({ route: p.route, home: p.home, goalM, router: p.router, simulate: p.simulate });
  const { tracker } = walk;
  // Real steps from the phone's pedometer when we have them, else GPS distance / stride.
  const steps =
    !p.simulate && walk.pedometerSteps != null ? walk.pedometerSteps : metersToSteps(tracker.odometerM, p.strideM);
  const pct = Math.min(100, Math.round((steps / p.goalSteps) * 100));
  const next = tracker.nextTurn;
  const step = next ? tracker.route.steps[next.i] : null;
  const homeStretch = !tracker.offRoute && tracker.remainingM < HOME_STRETCH_M && walk.position != null;

  // Report up to the screen (for the map) and detect the finish.
  const { onProgress, onFinish } = p;
  useEffect(() => {
    onProgress(tracker.route, tracker.index, walk.position);
    if (walk.position && tracker.finished) onFinish(steps, tracker.odometerM);
    // Only on new fixes or a new route; steps/odometer are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk.position, tracker.route]);

  // A small tap every 1,000 steps.
  const thousands = useRef(0);
  useEffect(() => {
    const k = Math.floor(steps / 1000);
    if (k > thousands.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    thousands.current = k;
  }, [steps]);

  const off = tracker.offRoute;
  const cardBg = off ? t.warnBg : t.turnCard;
  const cardFg = off ? t.warnFg : t.turnCardFg;
  const cardMuted = off ? t.warnFg : t.turnCardMuted;

  return (
    <>
      <View style={[styles.turnCard, { top: insets.top + 8, backgroundColor: cardBg }]}>
        {off ? (
          <View style={{ flex: 1, gap: 10 }}>
            <Text style={[styles.turnDist, { color: cardFg, fontSize: 24 }]}>Off the route</Text>
            <Text style={[styles.turnText, { color: cardMuted }]}>Head back to the line, or plan a new way home.</Text>
            <Button kind="outline" title="Re-plan the rest" onPress={walk.replan} busy={walk.replanning} />
          </View>
        ) : (
          <>
            <View style={[styles.turnTile, { backgroundColor: t.accent }]}>
              <TurnIcon turn={step?.turn} arrive={step?.arrive || homeStretch} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.turnDist, { color: cardFg }]}>
                {homeStretch ? "Home stretch" : next ? dist(next.distM) : walk.position ? dist(tracker.remainingM) : "…"}
              </Text>
              <Text numberOfLines={2} style={[styles.turnText, { color: cardMuted }]}>
                {homeStretch
                  ? `${dist(tracker.remainingM)} to go`
                  : next
                    ? next.text
                    : walk.position
                      ? "Follow the route home"
                      : walk.gpsError ?? "Waiting for GPS…"}
              </Text>
            </View>
          </>
        )}
      </View>

      <View onLayout={p.onSheetLayout} style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.between}>
          <View style={styles.baseline}>
            <Text style={[styles.steps, { color: t.fg }]}>{fmt(steps)}</Text>
            <Text style={[styles.of, { color: t.muted }]}>of {fmt(p.goalSteps)} steps</Text>
          </View>
          <Text style={[styles.pct, { color: t.fg }]}>{pct}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: t.track }]}>
          <View style={[styles.bar, { backgroundColor: t.accent, width: `${pct}%` }]} />
        </View>
        <View style={styles.tiles}>
          <Tile label="Today" value={fmt(steps + p.doneBefore)} />
          <Tile label="Home in" value={`${km(tracker.remainingM)} km`} />
        </View>
        <Button kind="outline" title="End walk" onPress={() => p.onFinish(steps, tracker.odometerM)} />
      </View>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.bg }]}>
      <Text style={[styles.tileLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: t.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  turnCard: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 22,
    padding: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  turnTile: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  turnDist: { fontFamily: font.display, fontSize: 30, letterSpacing: -0.5 },
  turnText: { fontSize: 16, fontFamily: font.body },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 18,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  between: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  baseline: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  steps: { fontFamily: font.display, fontSize: 44, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
  of: { fontSize: 16, fontFamily: font.body },
  pct: { fontSize: 16, fontFamily: font.bodySemi },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4 },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  tileLabel: { fontSize: 13, fontFamily: font.body },
  tileValue: { fontSize: 18, fontFamily: font.bodyBold, fontVariant: ["tabular-nums"] },
});
