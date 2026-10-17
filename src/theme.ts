import { useColorScheme } from "react-native";

// Colours and type from the "just10k UI" design canvas
// (https://claude.ai/artifact/LmbKPaG5n23bGpCdyWZ7fT).
const light = {
  bg: "#F2F4F1", // page ground
  card: "#FFFFFF", // cards, sheets, round buttons
  fg: "#121814", // ink
  fgSoft: "#3A423D", // tag text, secondary copy
  muted: "#5B6470",
  track: "#E1E5E0", // ring and progress track
  line: "#D5DAD6", // outlined button border
  dot: "#CDD3CC", // inactive page dot
  walked: "#A9B1AA", // the part of the route already walked
  ghost: "#9AA39C", // the loops you haven't picked
  accent: "#F0642E",
  primaryBg: "#121814", // the big black button
  primaryFg: "#FFFFFF",
  turnCard: "#121814",
  turnCardFg: "#FFFFFF",
  turnCardMuted: "#D5DAD6",
  warnBg: "#FFF1D6",
  warnFg: "#5A3A00",
  error: "#B42318",
};

const dark: typeof light = {
  bg: "#0E120F",
  card: "#1A201C",
  fg: "#EEF1EC",
  fgSoft: "#C9CFC8",
  muted: "#9AA39C",
  track: "#2A312C",
  line: "#3A423D",
  dot: "#3A423D",
  walked: "#5B6470",
  ghost: "#7D867F",
  accent: "#FF7442",
  primaryBg: "#EEF1EC",
  primaryFg: "#121814",
  turnCard: "#EEF1EC",
  turnCardFg: "#121814",
  turnCardMuted: "#3A423D",
  warnBg: "#3D2A06",
  warnFg: "#FFD98A",
  error: "#FF8A80",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

// Loaded in src/app/_layout.tsx. React Native needs one family name per weight.
export const font = {
  display: "BricolageGrotesque_700Bold",
  displayHeavy: "BricolageGrotesque_800ExtraBold",
  body: "Figtree_400Regular",
  bodySemi: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
};

export const km = (m: number) => (m / 1000).toFixed(1);
export const fmt = (n: number) => Math.round(n).toLocaleString();
