import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { metersToSteps, stepsToMeters, stepsToMinutes, type LatLon, type PlannedRoute, type Router } from "../lib/loop";
import type { Settings } from "../lib/settings";
import { openInGoogleMaps, shareGpx } from "../lib/share";
import { useWalk } from "../hooks/useWalk";
import { fmt, km, ROUTE_COLORS, useTheme } from "../theme";
import { Button, Field } from "./ui";

// ---------- 1. Set the goal ----------

type SetupProps = {
  settings: Settings;
  onChange: (s: Settings) => void;
  stepsLeft: number;
  strideM: number;
  autoSteps: boolean; // today's steps came from the phone
  startLabel: string;
  onSearch: (q: string) => void;
  onPlan: () => void;
  planning: boolean;
  canPlan: boolean;
  error: string | null;
};

export function SetupPanel(p: SetupProps) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const [showStride, setShowStride] = useState(false);
  const num = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;
  const m = stepsToMeters(p.stepsLeft, p.strideM);
  return (
    <View style={styles.view}>
      <View style={styles.brandRow}>
        <Text style={[styles.logo, { color: t.accent }]}>just10k</Text>
        <Text style={[styles.muted, { color: t.muted }]}>a new loop, every time</Text>
      </View>

      <View style={styles.row}>
        <Field
          label="Daily goal"
          keyboardType="number-pad"
          value={String(p.settings.goal)}
          onChangeText={(v) => p.onChange({ ...p.settings, goal: num(v) })}
        />
        <Field
          label={p.autoSteps ? "Walked today (from phone)" : "Walked today"}
          keyboardType="number-pad"
          value={String(p.settings.doneToday)}
          onChangeText={(v) => p.onChange({ ...p.settings, doneToday: num(v) })}
        />
      </View>

      <Text style={[styles.summary, { color: t.fg }]}>
        Walk <Text style={styles.bold}>{fmt(p.stepsLeft)}</Text> steps ≈{" "}
        <Text style={styles.bold}>{km(m)} km</Text>, about {stepsToMinutes(p.stepsLeft)} min
      </Text>

      <View style={styles.startRow}>
        <View style={[styles.dot, { backgroundColor: t.accent }]} />
        <Text style={{ color: t.fg, flex: 1 }}>{p.startLabel}</Text>
      </View>
      <Field
        label="Or start from an address (tip: long-press the map)"
        placeholder="Search…"
        returnKeyType="search"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => query.trim() && p.onSearch(query.trim())}
      />

      <Pressable onPress={() => setShowStride((s) => !s)}>
        <Text style={{ color: t.muted }}>{showStride ? "▾" : "▸"} Stride settings</Text>
      </Pressable>
      {showStride && (
        <View style={styles.row}>
          <Field
            label="Height (cm)"
            keyboardType="number-pad"
            value={String(p.settings.heightCm)}
            onChangeText={(v) => p.onChange({ ...p.settings, heightCm: num(v) })}
          />
          <Field
            label="Stride (cm), optional"
            keyboardType="number-pad"
            placeholder={`auto: ${Math.round(p.strideM * 100)}`}
            value={p.settings.strideCm ? String(p.settings.strideCm) : ""}
            onChangeText={(v) => p.onChange({ ...p.settings, strideCm: num(v) || null })}
          />
        </View>
      )}

      <Button title="Plan my walk" onPress={p.onPlan} busy={p.planning} disabled={!p.canPlan} />
      {p.error && <Text style={[styles.error, { color: t.error }]}>{p.error}</Text>}
    </View>
  );
}

// ---------- 2. Pick a loop ----------

type ResultsProps = {
  options: PlannedRoute[];
  selected: number;
  onSelect: (i: number) => void;
  strideM: number;
  target: number;
  start: LatLon;
  onShuffle: () => void;
  shuffling: boolean;
  onStart: (simulate: boolean) => void;
  onBack: () => void;
};

export function ResultsPanel(p: ResultsProps) {
  const t = useTheme();
  const sel = p.options[p.selected];
  return (
    <View style={styles.view}>
      <View style={styles.between}>
        <Button kind="link" title="‹ Back" onPress={p.onBack} />
        <Text style={{ color: t.muted }}>Target: {fmt(p.target)} steps</Text>
      </View>
      {p.options.map((r, i) => {
        const steps = metersToSteps(r.distance, p.strideM);
        const active = i === p.selected;
        return (
          <Pressable
            key={i}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => p.onSelect(i)}
            style={[styles.option, { backgroundColor: t.field, borderColor: active ? ROUTE_COLORS[i] : "transparent" }]}
          >
            <View style={[styles.swatch, { backgroundColor: ROUTE_COLORS[i] }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontSize: 17 }}>
                <Text style={styles.bold}>{fmt(steps)}</Text> steps
              </Text>
              <Text style={{ color: t.muted }}>
                {km(r.distance)} km · {stepsToMinutes(steps)} min
                {r.overlap > 0.15 ? "  ·  some doubling back" : ""}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <View style={styles.row}>
        <Button kind="secondary" title="Shuffle" onPress={p.onShuffle} busy={p.shuffling} flex={1} />
        <Button title="Start walk" onPress={() => p.onStart(false)} flex={2} />
      </View>
      <View style={styles.links}>
        <Button kind="link" title="Open in Google Maps" onPress={() => openInGoogleMaps(p.start, sel)} />
        <Button kind="link" title="Share GPX" onPress={() => shareGpx(sel)} />
        {__DEV__ && <Button kind="link" title="Simulate walk" onPress={() => p.onStart(true)} />}
      </View>
    </View>
  );
}

// ---------- 3. Walking ----------

type WalkProps = {
  route: PlannedRoute;
  home: LatLon;
  goalSteps: number;
  doneBefore: number;
  strideM: number;
  router: Router;
  simulate: boolean;
  onRouteChange: (r: PlannedRoute) => void;
  onPosition: (p: LatLon) => void;
  onFinish: (steps: number, meters: number) => void;
};

export function WalkPanel(p: WalkProps) {
  const t = useTheme();
  const goalM = stepsToMeters(p.goalSteps, p.strideM);
  const walk = useWalk({ route: p.route, home: p.home, goalM, router: p.router, simulate: p.simulate });
  const { tracker } = walk;
  // Real steps from the phone's pedometer when we have them, else GPS distance / stride.
  const steps =
    !p.simulate && walk.pedometerSteps != null ? walk.pedometerSteps : metersToSteps(tracker.odometerM, p.strideM);
  const next = tracker.nextTurn;

  // Report up to the screen (for the map) and detect the finish.
  const { onRouteChange, onPosition, onFinish } = p;
  useEffect(() => onRouteChange(tracker.route), [tracker.route, onRouteChange]);
  useEffect(() => {
    if (!walk.position) return;
    onPosition(walk.position);
    if (tracker.finished) onFinish(steps, tracker.odometerM);
    // Only on new fixes; steps/odometer are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk.position]);

  return (
    <View style={styles.view}>
      {tracker.offRoute && (
        <View style={[styles.banner, { backgroundColor: t.warnBg }]}>
          <Text style={{ color: t.warnFg, flex: 1 }}>{"You're off the route."}</Text>
          <Button kind="secondary" title="Re-plan the rest" onPress={walk.replan} busy={walk.replanning} />
        </View>
      )}
      {walk.gpsError && <Text style={{ color: t.error }}>{walk.gpsError}</Text>}
      <View>
        <Text style={[styles.instruction, { color: t.fg }]}>
          {next ? next.text : walk.position ? "Follow the route home" : "Waiting for GPS…"}
        </Text>
        {next && (
          <Text style={{ color: t.muted }}>
            in {next.distM < 1000 ? `${Math.round(next.distM / 10) * 10} m` : `${km(next.distM)} km`}
          </Text>
        )}
      </View>
      <View style={[styles.progress, { backgroundColor: t.field }]}>
        <View
          style={[styles.progressBar, { backgroundColor: t.accent, width: `${Math.min(100, (steps / p.goalSteps) * 100)}%` }]}
        />
      </View>
      <View style={styles.stats}>
        <Stat value={fmt(steps)} label="steps this walk" />
        <Stat value={fmt(steps + p.doneBefore)} label="today" />
        <Stat value={km(tracker.remainingM)} label="km to go" />
      </View>
      <Button kind="secondary" title="End walk" onPress={() => p.onFinish(steps, tracker.odometerM)} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: t.fg }]}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

// ---------- 4. Done ----------

export function DonePanel({ summary, onAgain }: { summary: string; onAgain: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.view}>
      <Text style={[styles.instruction, { color: t.fg }]}>🎉 Done!</Text>
      <Text style={{ color: t.fg, fontSize: 16 }}>{summary}</Text>
      <Button title="Plan another" onPress={onAgain} />
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: 12 },
  brandRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  logo: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  muted: { fontSize: 14 },
  row: { flexDirection: "row", gap: 10 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summary: { fontSize: 17 },
  bold: { fontWeight: "700" },
  startRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  error: { fontSize: 14 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 2, padding: 12 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 18 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 8, paddingLeft: 12 },
  instruction: { fontSize: 22, fontWeight: "700" },
  progress: { height: 10, borderRadius: 6, overflow: "hidden" },
  progressBar: { height: "100%" },
  stats: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
