import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../theme";

type ButtonProps = {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "link";
  busy?: boolean;
  disabled?: boolean;
  flex?: number;
};

export function Button({ title, onPress, kind = "primary", busy, disabled, flex }: ButtonProps) {
  const t = useTheme();
  const bg = kind === "primary" ? t.accent : kind === "secondary" ? t.field : "transparent";
  const fg = kind === "primary" ? t.accentFg : kind === "secondary" ? t.fg : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        kind === "link" ? styles.link : styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, flex },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[kind === "link" ? styles.linkText : styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...props}
        style={[styles.input, { backgroundColor: t.field, color: t.fg }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 17, fontWeight: "600" },
  link: { paddingVertical: 6 },
  linkText: { fontSize: 15 },
  field: { flex: 1, gap: 4 },
  label: { fontSize: 13 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 17 },
});
