import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { showPrivacyChoices, useAds } from "../lib/ads";
import { buyRemoveAds, canPurchase, restoreRemoveAds, usePurchases } from "../lib/purchases";
import { dayPart } from "../lib/describe";
import { stepsToMeters, stepsToMinutes } from "../lib/loop";
import { milestoneLabel, type Settings } from "../lib/settings";
import { fmt, font, km, useTheme } from "../theme";
import { Button, Field, Icon, Label, Pill, RoundButton, Sheet } from "./ui";

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  stepsLeft: number;
  milestone: number; // the goal, or 20k, 30k… once it's reached
  strideM: number;
  autoSteps: boolean; // today's steps came from the phone
  startLabel: string;
  onSearch: (q: string) => Promise<boolean>;
  onUseLocation: () => void;
  onPlan: (steps: number) => void;
  planning: boolean;
  canPlan: boolean;
  error: string | null;
};

const RING = 280;
const R = 118;
const CIRC = 2 * Math.PI * R;
const SET_TIMES = [15, 20, 30, 45, 60];

// 1 · Steps left
export function SetupScreen(p: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<"settings" | "start" | "time" | null>(null);
  const goal = p.settings.goal || 10000;
  const reached = p.milestone > goal;
  // The ring fills once per goal-sized lap, so it starts over on the way to 20k.
  const progress = Math.min(1, (p.settings.doneToday - (p.milestone - goal)) / goal);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.between}>
        <View style={styles.brand}>
          <Icon.Logo color={t.accent} />
          <Text style={[styles.logo, { color: t.fg }]}>just10k</Text>
        </View>
        <RoundButton label="Settings" onPress={() => setSheet("settings")}>
          <Icon.Sliders color={t.fg} />
        </RoundButton>
      </View>

      <Text style={[styles.day, { color: t.muted }]}>{dayPart()}</Text>

      <View style={styles.ring}>
        <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={t.track} strokeWidth={14} />
          {progress > 0 && (
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke={t.accent}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${progress * CIRC} ${CIRC}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          )}
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.bigNumber, { color: t.fg }]}>{fmt(p.stepsLeft)}</Text>
          <Text style={[styles.ringLabel, { color: t.muted }]}>{reached ? `steps to ${milestoneLabel(p.milestone)}` : "steps to go"}</Text>
        </View>
      </View>

      <Text style={[styles.sub, { color: t.muted }]}>
        {fmt(p.settings.doneToday)} of {fmt(p.milestone)} walked today
      </Text>
      <View style={styles.pills}>
        <Pill>≈ {km(stepsToMeters(p.stepsLeft, p.strideM))} km</Pill>
        <Pill>about {stepsToMinutes(p.stepsLeft)} min</Pill>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.actions}>
        <View style={[styles.startCard, { backgroundColor: t.card }]}>
          <Icon.Pin color={t.fg} />
          <View style={{ flex: 1 }}>
            <Label>Start and finish</Label>
            <Text numberOfLines={1} style={[styles.startText, { color: t.fg }]}>
              {p.startLabel}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setSheet("start")} hitSlop={8} style={styles.change}>
            <Text style={[styles.changeText, { color: t.fg }]}>Change</Text>
          </Pressable>
        </View>
        {p.error && <Text style={[styles.error, { color: t.error }]}>{p.error}</Text>}
        <Button
          title="Find me a loop"
          onPress={() => p.onPlan(p.stepsLeft)}
          busy={p.planning}
          disabled={!p.canPlan}
          iconAfter={<Icon.Arrow color={t.primaryFg} />}
        />
        <Button kind="quiet" title="Or walk for a set time" onPress={() => setSheet("time")} disabled={!p.canPlan} />
      </View>

      <SettingsSheet {...p} visible={sheet === "settings"} onClose={() => setSheet(null)} />
      <StartSheet {...p} visible={sheet === "start"} onClose={() => setSheet(null)} />
      <Sheet visible={sheet === "time"} title="Walk for a set time" onClose={() => setSheet(null)}>
        <Text style={[styles.body, { color: t.muted }]}>Pick a length and just10k plans a loop that fits.</Text>
        <View style={styles.times}>
          {SET_TIMES.map((min) => (
            <Button
              key={min}
              kind="soft"
              title={`${min} min`}
              style={styles.time}
              onPress={() => {
                setSheet(null);
                p.onPlan(min * 100); // ~100 steps a minute, as in stepsToMinutes
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const yesNo = (v: boolean | null) => (v == null ? "–" : v ? "yes" : "no");
const num = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;

function SettingsSheet(p: Props & { visible: boolean; onClose: () => void }) {
  const s = p.settings;
  const t = useTheme();
  const ad = useAds();
  const iap = usePurchases();
  return (
    <Sheet visible={p.visible} title="Settings" onClose={p.onClose}>
      <View style={styles.row}>
        <Field label="Daily goal" keyboardType="number-pad" value={String(s.goal)} onChangeText={(v) => p.onChange({ ...s, goal: num(v) })} />
        <Field
          label="Walked today"
          keyboardType="number-pad"
          value={String(s.doneToday)}
          editable={!p.autoSteps}
          hint={p.autoSteps ? "From your phone" : undefined}
          onChangeText={(v) => p.onChange({ ...s, doneToday: num(v) })}
        />
      </View>
      <View style={styles.row}>
        <Field label="Height (cm)" keyboardType="number-pad" value={String(s.heightCm)} onChangeText={(v) => p.onChange({ ...s, heightCm: num(v) })} />
        <Field
          label="Stride (cm)"
          keyboardType="number-pad"
          placeholder={`auto: ${Math.round(p.strideM * 100)}`}
          hint="Optional. Worked out from height if empty."
          value={s.strideCm ? String(s.strideCm) : ""}
          onChangeText={(v) => p.onChange({ ...s, strideCm: num(v) || null })}
        />
      </View>
      <RemoveAds />
      {ad.privacyOptions && !iap.adFree && <Button kind="soft" title="Ad privacy choices" onPress={showPrivacyChoices} />}
      {/* Ad diagnostics, for development builds only. */}
      {__DEV__ && (
        <Text style={[styles.adStatus, { color: t.muted }]} selectable>
          Ads: consent {ad.consentStatus ?? "–"} · GDPR {yesNo(ad.gdprApplies)} · can request {yesNo(ad.canRequestAds)}
          {ad.lastError ? ` · ${ad.lastError}` : ""}
        </Text>
      )}
    </Sheet>
  );
}

// One payment, ads gone for good. Restore covers a reinstall or a new phone.
function RemoveAds() {
  const t = useTheme();
  const iap = usePurchases();
  if (!canPurchase) return null;
  if (iap.adFree) return <Text style={[styles.body, { color: t.muted }]}>Ads removed. Thanks for supporting just10k!</Text>;
  return (
    <View style={styles.removeAds}>
      {iap.price && <Button kind="outline" title={`Remove ads · ${iap.price}`} onPress={buyRemoveAds} busy={iap.busy} />}
      <Button kind="quiet" title="Restore purchase" onPress={restoreRemoveAds} disabled={iap.busy} />
      {iap.message && <Text style={[styles.adStatus, { color: t.muted }]}>{iap.message}</Text>}
    </View>
  );
}

function StartSheet(p: Props & { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible={p.visible} title="Start and finish" onClose={p.onClose}>
      <Field
        label="Start from an address"
        placeholder="Search…"
        returnKeyType="search"
        autoFocus
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={async () => {
          if (!query.trim()) return;
          setBusy(true);
          const found = await p.onSearch(query.trim());
          setBusy(false);
          if (found) p.onClose();
        }}
      />
      {busy && <Text style={[styles.body, { color: t.muted }]}>Searching…</Text>}
      {p.error && <Text style={[styles.error, { color: t.error }]}>{p.error}</Text>}
      <Button
        kind="soft"
        title="Use where I am now"
        icon={<Icon.Pin color={t.fg} size={20} />}
        onPress={() => {
          p.onUseLocation();
          p.onClose();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, paddingHorizontal: 24 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { fontFamily: font.displayHeavy, fontSize: 22, letterSpacing: -0.5 },
  day: { marginTop: 28, fontSize: 16, fontFamily: font.body, textAlign: "center" },
  ring: { width: RING, height: RING, alignSelf: "center", marginTop: 16 },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 2 },
  bigNumber: { fontFamily: font.display, fontSize: 64, letterSpacing: -2, fontVariant: ["tabular-nums"] },
  ringLabel: { fontSize: 17, fontFamily: font.body },
  sub: { marginTop: 16, fontSize: 15, fontFamily: font.body, textAlign: "center" },
  pills: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 20 },
  actions: { gap: 12 },
  startCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingVertical: 14, paddingLeft: 16, paddingRight: 8 },
  startText: { fontSize: 16, fontFamily: font.bodySemi },
  change: { paddingVertical: 12, paddingHorizontal: 8 },
  changeText: { fontSize: 15, fontFamily: font.bodySemi },
  error: { fontSize: 14, fontFamily: font.body },
  body: { fontSize: 16, fontFamily: font.body },
  row: { flexDirection: "row", gap: 12 },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  time: { flexGrow: 1, minWidth: "28%" },
  adStatus: { fontSize: 12, fontFamily: font.body },
  removeAds: { gap: 4 },
});
