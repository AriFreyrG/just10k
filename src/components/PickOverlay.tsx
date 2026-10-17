import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loopName, loopTags } from "../lib/describe";
import { metersToSteps, stepsToMinutes, type LatLon, type PlannedRoute } from "../lib/loop";
import { openInGoogleMaps, shareGpx } from "../lib/share";
import { fmt, font, km, useTheme } from "../theme";
import { Button, Icon, Pill, RoundButton } from "./ui";

type Props = {
  options: PlannedRoute[];
  selected: number;
  onSelect: (i: number) => void;
  strideM: number;
  start: LatLon;
  onShuffle: () => void;
  shuffling: boolean;
  onStart: (simulate: boolean) => void;
  onBack: () => void;
  onSheetLayout: (e: LayoutChangeEvent) => void;
};

// 2 · Pick a loop: drawn over the map.
export function PickOverlay(p: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollViewInstance>(null);
  const sel = p.options[p.selected];

  // Keep the cards in step when a loop is picked by tapping it on the map.
  useEffect(() => {
    pager.current?.scrollTo({ x: p.selected * width, animated: true });
  }, [p.selected, width]);

  return (
    <>
      <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
        <RoundButton label="Back" onPress={p.onBack}>
          <Icon.Back color={t.fg} />
        </RoundButton>
        <Pill>
          Loop {p.selected + 1} of {p.options.length}
        </Pill>
      </View>

      <View onLayout={p.onSheetLayout} style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: t.track }]} />
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => p.onSelect(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {p.options.map((r, i) => {
            const steps = metersToSteps(r.distance, p.strideM);
            return (
              <View key={`${r.seed}-${i}`} style={[styles.card, { width }]} accessibilityLabel={`Loop ${i + 1}`}>
                <Text numberOfLines={1} style={[styles.name, { color: t.fg }]}>
                  {loopName(r, `Loop ${i + 1}`)}
                </Text>
                <View style={styles.tags}>
                  {loopTags(r).map((tag) => (
                    <Pill key={tag} soft>
                      {tag}
                    </Pill>
                  ))}
                </View>
                <View style={styles.stats}>
                  <Stat value={fmt(steps)} label="steps" testID="loop-steps" />
                  <Stat value={`${km(r.distance)} km`} label="distance" />
                  <Stat value={`${stepsToMinutes(steps)} min`} label="walking" />
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inner}>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {p.options.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === p.selected ? { width: 18, backgroundColor: t.fg } : { backgroundColor: t.dot }]}
              />
            ))}
          </View>
          <View style={styles.row}>
            <Button
              kind="soft"
              title=""
              label="Shuffle for new loops"
              onPress={p.onShuffle}
              busy={p.shuffling}
              icon={<Icon.Shuffle color={t.fg} />}
              style={styles.shuffle}
            />
            <Button title="Start walk" onPress={() => p.onStart(false)} style={{ flex: 1 }} />
          </View>
          <View style={styles.links}>
            <Button kind="quiet" title="Google Maps" onPress={() => openInGoogleMaps(p.start, sel)} />
            <Button kind="quiet" title="Share GPX" onPress={() => shareGpx(sel)} />
            {__DEV__ && <Button kind="quiet" title="Simulate walk" onPress={() => p.onStart(true)} />}
          </View>
        </View>
      </View>
    </>
  );
}

function Stat({ value, label, testID }: { value: string; label: string; testID?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text testID={testID} style={[styles.statValue, { color: t.fg }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 18 },
  card: { paddingHorizontal: 24, gap: 18 },
  name: { fontFamily: font.display, fontSize: 28, letterSpacing: -0.6 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -8 },
  stats: { flexDirection: "row", gap: 8 },
  statValue: { fontFamily: font.display, fontSize: 24, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 13, fontFamily: font.body },
  inner: { paddingHorizontal: 24, gap: 14, marginTop: 18 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  row: { flexDirection: "row", gap: 10 },
  shuffle: { width: 58, height: 58, paddingHorizontal: 0, gap: 0 },
  links: { flexDirection: "row", justifyContent: "center", marginTop: -6 },
});
