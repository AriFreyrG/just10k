import { Linking } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { toGpx, type LatLon, type PlannedRoute } from "./loop";
import { today } from "./settings";

const ll = (p: LatLon) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

// Open the loop as walking directions in Apple Maps, the built-in iOS map app.
export function appleMapsUrl(start: LatLon, route: PlannedRoute) {
  const q = [
    `source=${ll(start)}`,
    `destination=${ll(start)}`,
    ...route.waypoints.map((w) => `waypoint=${ll(w)}`),
    "mode=walking",
  ].join("&");
  return `https://maps.apple.com/directions?${q}`;
}

export function openInAppleMaps(start: LatLon, route: PlannedRoute) {
  return Linking.openURL(appleMapsUrl(start, route));
}

// Share the loop as a GPX file, e.g. to load onto a Garmin or into Strava.
export async function shareGpx(route: PlannedRoute) {
  const file = new File(Paths.cache, `just10k-${today()}.gpx`);
  await file.write(toGpx(route.coords));
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/gpx+xml",
    UTI: "com.topografix.gpx",
    dialogTitle: "Share walk as GPX",
  });
}
