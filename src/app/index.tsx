import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useColorScheme, View, type LayoutChangeEvent } from "react-native";
import MapView, { Marker, Polyline, type LatLng } from "react-native-maps";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoneScreen, type WalkSummary } from "../components/DoneScreen";
import { PickOverlay } from "../components/PickOverlay";
import { SetupScreen } from "../components/SetupScreen";
import { WalkOverlay } from "../components/WalkOverlay";
import { loopName } from "../lib/describe";
import { geocode } from "../lib/geocode";
import { planOptions, stepsToMeters, strideFromHeight, type LatLon, type PlannedRoute } from "../lib/loop";
import { osrmRouter } from "../lib/osrm";
import { DEFAULTS, loadSettings, saveSettings, type Settings } from "../lib/settings";
import { shareGpx } from "../lib/share";
import { stepsToday } from "../lib/steps";
import { useTheme } from "../theme";

type Phase = "setup" | "results" | "walk" | "done";

const router = osrmRouter();
const toLatLng = ([latitude, longitude]: LatLon): LatLng => ({ latitude, longitude });

async function findMe(): Promise<{ point?: LatLon; label: string }> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { label: "Location is off. Tap Change to search." };
    const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { point: [here.coords.latitude, here.coords.longitude], label: "Where you are now" };
  } catch {
    return { label: "Couldn't find you. Tap Change to search." };
  }
}

export default function Home() {
  const t = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [autoSteps, setAutoSteps] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [start, setStart] = useState<LatLon | null>(null);
  const [startLabel, setStartLabel] = useState("Finding your location…");
  const [target, setTarget] = useState(0);
  const [options, setOptions] = useState<PlannedRoute[]>([]);
  const [selected, setSelected] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walkRoute, setWalkRoute] = useState<PlannedRoute | null>(null);
  const [walkIndex, setWalkIndex] = useState(0);
  const [walkStartedAt, setWalkStartedAt] = useState(0);
  const [simulate, setSimulate] = useState(false);
  const [simPos, setSimPos] = useState<LatLon | null>(null);
  const [summary, setSummary] = useState<WalkSummary | null>(null);
  const [sheetHeight, setSheetHeight] = useState(320);

  const strideM = settings.strideCm ? settings.strideCm / 100 : strideFromHeight(settings.heightCm || 170);
  const goal = settings.goal || 10000;
  const stepsLeft = Math.max(500, goal - settings.doneToday);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const locate = useCallback(() => {
    findMe().then(({ point, label }) => {
      if (point) setStart(point);
      setStartLabel(label);
    });
  }, []);

  // Load settings, today's steps (iPhone) and the current location.
  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      const phoneSteps = await stepsToday();
      if (phoneSteps != null) {
        setAutoSteps(true);
        s.doneToday = Math.max(s.doneToday, phoneSteps);
      }
      setSettings(s);
    })();
    locate();
  }, [locate]);

  function fit(coords: LatLon[]) {
    map.current?.fitToCoordinates(coords.map(toLatLng), {
      edgePadding: { top: insets.top + (phase === "walk" ? 150 : 70), right: 40, bottom: sheetHeight + 30, left: 40 },
      animated: true,
    });
  }

  async function plan(steps: number) {
    if (!start) return;
    setPlanning(true);
    setError(null);
    setTarget(steps);
    try {
      const routes = await planOptions({
        start,
        targetM: stepsToMeters(steps, strideM),
        router,
        seed: Math.floor(Math.random() * 2 ** 31),
      });
      setOptions(routes);
      setSelected(0);
      setPhase("results");
    } catch (e) {
      setPhase("setup");
      setError(`Couldn't plan a loop: ${(e as Error).message}. Try again in a moment.`);
    } finally {
      setPlanning(false);
    }
  }

  // Refit the map whenever the loop on show or the sheet size changes.
  const shown = phase === "walk" ? walkRoute : phase === "results" ? options[selected] : null;
  useEffect(() => {
    if (shown) fit(shown.coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, sheetHeight]);

  const onSheetLayout = useCallback((e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height), []);

  const onProgress = useCallback(
    (route: PlannedRoute, index: number, pos: LatLon | null) => {
      setWalkRoute(route);
      setWalkIndex(index);
      if (simulate) setSimPos(pos);
    },
    [simulate]
  );

  const onFinish = useCallback(
    (steps: number, meters: number) => {
      setPhase((ph) => {
        if (ph !== "walk" || !walkRoute) return ph;
        const today = settings.doneToday + steps;
        updateSettings({ ...settings, doneToday: today });
        setSummary({
          name: loopName(options[selected] ?? walkRoute, "Today's loop"),
          coords: walkRoute.coords,
          steps,
          meters,
          minutes: Math.max(1, Math.round((Date.now() - walkStartedAt) / 60000)),
          today,
          goal,
        });
        return "done";
      });
    },
    [settings, updateSettings, walkRoute, walkStartedAt, options, selected, goal]
  );

  // Selected loop on top, with a white casing; the others as grey dotted ghosts.
  const lines = useMemo(() => {
    type Line = { key: string; coords: LatLon[]; color: string; width: number; dash?: number[]; i?: number };
    const out: Line[] = [];
    const bold = (key: string, coords: LatLon[], i?: number) => {
      out.push({ key: `${key}-casing`, coords, color: "#FFFFFF", width: 11, i });
      out.push({ key, coords, color: t.accent, width: 6, i });
    };
    if (phase === "results") {
      options.forEach((r, i) => {
        if (i !== selected) out.push({ key: `ghost-${i}`, coords: r.coords, color: t.ghost, width: 3, dash: [2, 8], i });
      });
      if (options[selected]) bold(`loop-${selected}`, options[selected].coords, selected);
    }
    if (phase === "walk" && walkRoute) {
      const at = Math.min(walkIndex, walkRoute.coords.length - 1);
      if (at > 0) out.push({ key: "walked", coords: walkRoute.coords.slice(0, at + 1), color: t.walked, width: 6 });
      bold("ahead", walkRoute.coords.slice(at));
    }
    return out;
  }, [phase, options, selected, walkRoute, walkIndex, t]);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        showsUserLocation={!simulate}
        showsMyLocationButton={false}
        showsCompass={false}
        userInterfaceStyle={scheme === "dark" ? "dark" : "light"}
      >
        {lines.map((l) => (
          <Polyline
            key={l.key}
            coordinates={l.coords.map(toLatLng)}
            strokeColor={l.color}
            strokeWidth={l.width}
            lineDashPattern={l.dash}
            tappable={l.i != null}
            onPress={() => l.i != null && setSelected(l.i)}
          />
        ))}
        {start && (phase === "results" || phase === "walk") && (
          <Marker coordinate={toLatLng(start)} anchor={{ x: 0.5, y: 0.5 }} title="Start and finish">
            <View style={[styles.startOuter]}>
              <View style={[styles.startInner, { backgroundColor: "#121814" }]} />
            </View>
          </Marker>
        )}
        {simulate && simPos && phase === "walk" && (
          <Marker coordinate={toLatLng(simPos)} anchor={{ x: 0.5, y: 0.5 }} title="You (simulated)">
            <View style={[styles.youHalo, { backgroundColor: `${t.accent}2E` }]}>
              <View style={styles.youRing}>
                <View style={[styles.youDot, { backgroundColor: t.accent }]} />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {phase === "setup" && (
        <SetupScreen
          settings={settings}
          onChange={updateSettings}
          stepsLeft={stepsLeft}
          strideM={strideM}
          autoSteps={autoSteps}
          startLabel={startLabel}
          onSearch={async (q) => {
            try {
              const hit = await geocode(q);
              if (!hit) {
                setError("Couldn't find that address.");
                return false;
              }
              setStart(hit.point);
              setStartLabel(hit.label);
              setError(null);
              return true;
            } catch {
              setError("Address search failed. Check your connection.");
              return false;
            }
          }}
          onUseLocation={() => {
            setStartLabel("Finding your location…");
            locate();
          }}
          onPlan={plan}
          planning={planning}
          canPlan={!!start}
          error={error}
        />
      )}
      {phase === "results" && start && (
        <PickOverlay
          options={options}
          selected={selected}
          onSelect={setSelected}
          strideM={strideM}
          start={start}
          onShuffle={() => plan(target)}
          shuffling={planning}
          onBack={() => setPhase("setup")}
          onSheetLayout={onSheetLayout}
          onStart={(sim) => {
            setSimulate(sim);
            setSimPos(null);
            setWalkRoute(options[selected]);
            setWalkIndex(0);
            setWalkStartedAt(Date.now());
            setPhase("walk");
          }}
        />
      )}
      {phase === "walk" && walkRoute && start && (
        <WalkOverlay
          route={walkRoute}
          home={start}
          goalSteps={target}
          doneBefore={settings.doneToday}
          strideM={strideM}
          router={router}
          simulate={simulate}
          onProgress={onProgress}
          onFinish={onFinish}
          onSheetLayout={onSheetLayout}
        />
      )}
      {phase === "done" && summary && (
        <DoneScreen
          summary={summary}
          onShare={() => walkRoute && shareGpx(walkRoute)}
          onClose={() => {
            setSimulate(false);
            setPhase("setup");
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  startOuter: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  startInner: { width: 14, height: 14, borderRadius: 7 },
  youHalo: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  youRing: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  youDot: { width: 14, height: 14, borderRadius: 7 },
});
