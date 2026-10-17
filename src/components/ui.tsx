import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { font, useTheme } from "../theme";

// ---------- Buttons ----------

type ButtonProps = {
  title: string;
  onPress: () => void;
  kind?: "primary" | "outline" | "quiet" | "soft";
  icon?: ReactNode;
  iconAfter?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string; // accessibility label, for icon-only buttons
};

export function Button({ title, onPress, kind = "primary", icon, iconAfter, busy, disabled, style, label }: ButtonProps) {
  const t = useTheme();
  const look = {
    primary: { bg: t.primaryBg, fg: t.primaryFg, border: "transparent", h: 58, size: 18, family: font.bodyBold },
    outline: { bg: t.card, fg: t.fg, border: t.line, h: 52, size: 16, family: font.bodySemi },
    soft: { bg: t.bg, fg: t.fg, border: "transparent", h: 52, size: 16, family: font.bodySemi },
    quiet: { bg: "transparent", fg: t.muted, border: "transparent", h: 44, size: 15, family: font.body },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        {
          height: look.h,
          backgroundColor: look.bg,
          borderColor: look.border,
          borderWidth: kind === "outline" ? 1.5 : 0,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <>
          {icon}
          {title !== "" && <Text style={{ color: look.fg, fontSize: look.size, fontFamily: look.family }}>{title}</Text>}
          {iconAfter}
        </>
      )}
    </Pressable>
  );
}

// 44pt round icon button on a card background.
export function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export function Pill({ children, soft }: { children: ReactNode; soft?: boolean }) {
  const t = useTheme();
  return (
    <View style={[soft ? styles.tag : styles.pill, { backgroundColor: soft ? t.bg : t.card }]}>
      <Text style={soft ? { color: t.fgSoft, fontSize: 14, fontFamily: font.body } : { color: t.fg, fontSize: 15, fontFamily: font.bodySemi }}>
        {children}
      </Text>
    </View>
  );
}

// ---------- Text ----------

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 13, fontFamily: font.body }}>{children}</Text>;
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={t.muted}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, { backgroundColor: t.bg, color: t.fg, opacity: props.editable === false ? 0.6 : 1 }]}
      />
      {hint && <Text style={{ color: t.muted, fontSize: 12, fontFamily: font.body }}>{hint}</Text>}
    </View>
  );
}

// ---------- Sheet ----------

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: t.card }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: t.fg }]}>{title}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={{ color: t.fg, fontSize: 16, fontFamily: font.bodySemi }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------- Icons (24×24 stroke icons, as on the canvas) ----------

type IconProps = { color: string; size?: number; width?: number };
const stroke = (color: string, width = 2) =>
  ({ fill: "none", stroke: color, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;

export const Icon = {
  Logo: ({ color, size = 22 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 18 C 2 15, 3 6, 10 5 S 22 7, 20 14 S 12 21, 7 18 Z" {...stroke(color, 3)} />
    </Svg>
  ),
  Sliders: ({ color, size = 20 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...stroke(color)} />
      <Circle cx="16" cy="7" r="2" {...stroke(color)} />
      <Circle cx="10" cy="17" r="2" {...stroke(color)} />
    </Svg>
  ),
  Back: ({ color, size = 20 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 6l-6 6 6 6" {...stroke(color, 2.4)} />
    </Svg>
  ),
  Close: ({ color, size = 18 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" {...stroke(color, 2.4)} />
    </Svg>
  ),
  Arrow: ({ color, size = 20 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12h14M13 6l6 6-6 6" {...stroke(color, 2.4)} />
    </Svg>
  ),
  Pin: ({ color, size = 22 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" {...stroke(color)} />
      <Circle cx="12" cy="9.5" r="2.5" {...stroke(color)} />
    </Svg>
  ),
  Shuffle: ({ color, size = 22 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3.5-1.5 4.7-3.5M13.3 10.5C14.5 8.5 16 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3"
        {...stroke(color, 2.2)}
      />
    </Svg>
  ),
  Share: ({ color, size = 20 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" {...stroke(color, 2.2)} />
    </Svg>
  ),
};

// Big turn arrow for walk mode, picked from the OSRM maneuver modifier.
export function TurnIcon({ turn, arrive, color, size = 30 }: { turn?: string; arrive?: boolean; color: string; size?: number }) {
  const s = stroke(color, 2.6);
  let d = "M12 20V4M6 10l6-6 6 6"; // straight on
  if (arrive) d = "M5 12l5 5 9-10";
  else if (turn === "uturn") d = "M8 20V9a5 5 0 0 1 10 0v3M14 9l4 4 4-4";
  else if (turn === "left" || turn === "sharp left") d = "M17 20v-7a4 4 0 0 0-4-4H5M9 5L5 9l4 4";
  else if (turn === "right" || turn === "sharp right") d = "M7 20v-7a4 4 0 0 1 4-4h8M15 5l4 4-4 4";
  else if (turn === "slight left") d = "M15 20v-6L8 6M8 12V6h6";
  else if (turn === "slight right") d = "M9 20v-6l7-8M16 12V6h-6";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} {...s} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pill: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  tag: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  field: { flex: 1, gap: 6 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontFamily: font.body },
  sheet: { flex: 1 },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 24, fontFamily: font.display, letterSpacing: -0.5 },
  sheetBody: { padding: 24, gap: 18 },
});
