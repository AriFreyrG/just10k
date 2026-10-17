import { useColorScheme } from "react-native";

const light = {
  bg: "#ffffff",
  fg: "#0f172a",
  muted: "#64748b",
  field: "#f1f5f9",
  accent: "#0f766e",
  accentFg: "#ffffff",
  warnBg: "#fef3c7",
  warnFg: "#92400e",
  error: "#b91c1c",
};

const dark: typeof light = {
  bg: "#0f172a",
  fg: "#e2e8f0",
  muted: "#94a3b8",
  field: "#1e293b",
  accent: "#14b8a6",
  accentFg: "#042f2e",
  warnBg: "#451a03",
  warnFg: "#fcd34d",
  error: "#f87171",
};

export type Theme = typeof light;
export const ROUTE_COLORS = ["#0f766e", "#7c3aed", "#ea580c"];

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const km = (m: number) => (m / 1000).toFixed(1);
export const fmt = (n: number) => Math.round(n).toLocaleString();
