import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import MapView, { Marker, Polyline, type LatLng } from "react-native-maps";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DonePanel, ResultsPanel, SetupPanel, WalkPanel } from "../components/panels";
import { geocode } from "../lib/geocode";
import { planOptions, stepsToMeters, strideFromHeight, type LatLon, type PlannedRoute } from "../lib/loop";
import { osrmRouter } from "../lib/osrm";
import { DEFAULTS, loadSettings, saveSettings, type Settings } from "../lib/settings";
import { stepsToday } from "../lib/steps";
import { fmt, km, ROUTE_COLORS, useTheme } from "../theme";

type Phase = "setup" | "results" | "walk" | "done";

const router = osrmRouter();
const toLatLng = ([latitude, longitude]: LatLon): LatLng => ({ latitude, longitude });

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
  const [options, setOptions] = useState<PlannedRoute[]>([]);
  const [selected, setSelected] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walkRoute, setWalkRoute] = useState<PlannedRoute | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [simPos, setSimPos] = useState<LatLon | null>(null);
  const [summary, setSummary] = useState("");
  const [panelHeight, setPanelHeight] = useState(300);

  const strideM = settings.strideCm ? settings.strideCm / 100 : strideFromHeight(settings.heightCm || 170);
  const stepsLeft = Math.max(500, (settings.goal || 10000) - settings.doneToday);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
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
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return setStartLabel("Location is off. Long-press the map or search instead.");
      const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      moveStart([here.coords.latitude, here.coords.longitude], "Start: your location");
    })().catch(() => setStartLabel("Couldn't get your location. Long-press the map or search."));
  }, []);

  function moveStart(p: LatLon, label: string) {
    setStart(p);
    setStartLabel(label);
    map.current?.animateToRegion({ ...toLatLng(p), latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }

  function fit(coords: LatLon[]) {
    map.current?.fitToCoordinates(coords.map(toLatLng), {
      edgePadding: { top: insets.top + 40, right: 40, bottom: panelHeight + 40, left: 40 },
      animated: true,
    });
  }

  async function plan() {
    if (!start) return;
    setPlanning(true);
    setError(null);
    try {
      const routes = await planOptions({
        start,
        targetM: stepsToMeters(stepsLeft, strideM),
        router,
        seed: Math.floor(Math.random() * 2 ** 31),
      });
      setOptions(routes);
      setSelected(0);
      setPhase("results");
    } catch (e) {
      setPhase("setup");
      setError(`Couldn't plan a route: ${(e as Error).message}. Try again in a moment.`);
    } finally {
      setPlanning(false);
    }
  }

  // Refit the map whenever the loop on show or the panel size changes.
  const shown = phase === "walk" ? walkRoute : phase === "results" ? options[selected] : null;
  useEffect(() => {
    if (shown) fit(shown.coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, panelHeight]);

  const onFinish = useCallback(
    (steps: number, meters: number) => {
      setPhase((ph) => {
        if (ph !== "walk") return ph;
        const total = settings.doneToday + steps;
        updateSettings({ ...settings, doneToday: total });
        setSummary(`About ${fmt(steps)} steps (${km(meters)} km) this walk. ${fmt(total)} today.`);
        return "done";
      });
    },
    [settings, updateSettings]
  );
  const onPosition = useCallback((p: LatLon) => simulate && setSimPos(p), [simulate]);

  const lines = useMemo(() => {
    if (phase === "walk" && walkRoute) return [{ route: walkRoute, color: ROUTE_COLORS[selected], active: true }];
    if (phase !== "results") return [];
    // Unselected first so the selected loop draws on top.
    return options
      .map((route, i) => ({ route, color: ROUTE_COLORS[i], active: i === selected, i }))
      .sort((a, b) => Number(a.active) - Number(b.active));
  }, [phase, walkRoute, options, selected]);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={scheme === "dark" ? "dark" : "light"}
        onLongPress={(e) => {
          if (phase !== "setup") return;
          const { latitude, longitude } = e.nativeEvent.coordinate;
          moveStart([latitude, longitude], "Start: dropped pin");
        }}
      >
        {start && <Marker coordinate={toLatLng(start)} pinColor={t.accent} title="Start" />}
        {lines.map(({ route, color, active }, k) => (
          <Polyline
            key={`${k}-${route.seed}-${active}`}
            coordinates={route.coords.map(toLatLng)}
            strokeColor={active ? color : `${color}59`}
            strokeWidth={active ? 6 : 4}
            tappable={phase === "results"}
            onPress={() => phase === "results" && setSelected(options.indexOf(route))}
          />
        ))}
        {simulate && simPos && phase === "walk" && (
          <Marker coordinate={toLatLng(simPos)} pinColor="#2563eb" title="You (simulated)" />
        )}
      </MapView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : undefined}
        style={styles.panelWrap}
        pointerEvents="box-none"
      >
        <View
          onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
          style={[styles.panel, { backgroundColor: t.bg, paddingBottom: insets.bottom + 16 }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {phase === "setup" && (
              <SetupPanel
                settings={settings}
                onChange={updateSettings}
                stepsLeft={stepsLeft}
                strideM={strideM}
                autoSteps={autoSteps}
                startLabel={startLabel}
                onSearch={async (q) => {
                  try {
                    const hit = await geocode(q);
                    if (hit) moveStart(hit.point, `Start: ${hit.label}`);
                    else setError("Couldn't find that address.");
                  } catch {
                    setError("Address search failed. Check your connection.");
                  }
                }}
                onPlan={plan}
                planning={planning}
                canPlan={!!start}
                error={error}
              />
            )}
            {phase === "results" && start && (
              <ResultsPanel
                options={options}
                selected={selected}
                onSelect={setSelected}
                strideM={strideM}
                target={stepsLeft}
                start={start}
                onShuffle={plan}
                shuffling={planning}
                onBack={() => setPhase("setup")}
                onStart={(sim) => {
                  setSimulate(sim);
                  setSimPos(null);
                  setWalkRoute(options[selected]);
                  setPhase("walk");
                }}
              />
            )}
            {phase === "walk" && walkRoute && start && (
              <WalkPanel
                route={walkRoute}
                home={start}
                goalSteps={stepsLeft}
                doneBefore={settings.doneToday}
                strideM={strideM}
                router={router}
                simulate={simulate}
                onRouteChange={setWalkRoute}
                onPosition={onPosition}
                onFinish={onFinish}
              />
            )}
            {phase === "done" && (
              <DonePanel
                summary={summary}
                onAgain={() => {
                  setPhase("setup");
                  if (start) moveStart(start, startLabel);
                }}
              />
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  panelWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  panel: {
    maxHeight: 520,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
});
