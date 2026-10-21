import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { routeShape, shortDate } from "../lib/describe";
import type { LatLon } from "../lib/loop";
import { milestoneLabel, nextMilestone } from "../lib/settings";
import { fmt, font, km, useTheme } from "../theme";
import { AdBanner } from "./AdBanner";
import { Button, Icon, RoundButton } from "./ui";

export type WalkSummary = {
  name: string;
  coords: LatLon[];
  steps: number;
  meters: number;
  minutes: number;
  today: number;
  goal: number;
};

type Props = { summary: WalkSummary; onShare: () => void; onClose: () => void; onNext: () => void; planning: boolean };

const STAMP = 250;

// 4 · Done: today's loop as a stamp.
export function DoneScreen({ summary: s, onShare, onClose, onNext, planning }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pts = routeShape(s.coords, STAMP, STAMP, 46);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  // Did this walk carry the day past the goal (or 20k, 30k…)? Then offer the next one.
  const next = nextMilestone(s.today, s.goal);
  const crossed = Math.floor(s.today / s.goal) > Math.floor((s.today - s.steps) / s.goal);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.closeRow}>
        <RoundButton label="Close" onPress={onClose}>
          <Icon.Close color={t.fg} />
        </RoundButton>
      </View>

      <View style={[styles.stamp, { backgroundColor: t.card }]}>
        <Svg width={STAMP} height={STAMP} accessibilityLabel="The shape of today's loop">
          <Circle cx={STAMP / 2} cy={STAMP / 2} r={112} fill="none" stroke={t.track} strokeWidth={2} strokeDasharray="1 7" strokeLinecap="round" />
          {pts.length > 1 && <Path d={d} fill="none" stroke={t.accent} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />}
          {pts.length > 0 && <Circle cx={pts[0].x} cy={pts[0].y} r={8} fill={t.fg} stroke={t.card} strokeWidth={4} />}
        </Svg>
      </View>

      <Text numberOfLines={1} style={[styles.kicker, { color: t.muted }]}>
        {shortDate()} · {s.name}
      </Text>
      <Text style={[styles.total, { color: t.fg }]}>{fmt(s.today)}</Text>
      <Text style={[styles.cheer, { color: t.fgSoft }]}>
        {crossed ? `steps today. Nicely done. Up for ${milestoneLabel(next)}?` : `steps today. ${fmt(next - s.today)} to go.`}
      </Text>

      <View style={[styles.stats, { backgroundColor: t.card }]}>
        <Stat value={fmt(s.steps)} label="this walk" />
        <Stat value={`${km(s.meters)} km`} label="distance" />
        <Stat value={`${s.minutes} min`} label="time" />
      </View>

      <View style={{ flex: 1 }} />
      <AdBanner />

      <View style={styles.actions}>
        {crossed && (
          <Button
            title={`Find me a ${milestoneLabel(next)} loop`}
            onPress={onNext}
            busy={planning}
            iconAfter={<Icon.Arrow color={t.primaryFg} />}
          />
        )}
        <Button
          kind={crossed ? "soft" : "primary"}
          title="Share my loop"
          onPress={onShare}
          icon={<Icon.Share color={crossed ? t.fg : t.primaryFg} />}
        />
        <Button kind="quiet" title="Back to start" onPress={onClose} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: t.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, paddingHorizontal: 24, alignItems: "center" },
  closeRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "flex-end" },
  stamp: { marginTop: 12, width: STAMP, height: STAMP, borderRadius: STAMP / 2, overflow: "hidden" },
  kicker: { marginTop: 22, fontSize: 14, fontFamily: font.bodySemi, letterSpacing: 1.4, textTransform: "uppercase" },
  total: { marginTop: 10, fontFamily: font.displayHeavy, fontSize: 76, letterSpacing: -3, lineHeight: 80, fontVariant: ["tabular-nums"] },
  cheer: { marginTop: 4, fontSize: 18, fontFamily: font.body },
  stats: { marginTop: 28, alignSelf: "stretch", flexDirection: "row", borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontFamily: font.bodyBold, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 13, fontFamily: font.body },
  actions: { alignSelf: "stretch", gap: 8, marginTop: 12 },
});
