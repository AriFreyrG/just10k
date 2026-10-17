import { Linking } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { toGpx, type LatLon, type PlannedRoute } from "./loop";
import { today } from "./settings";

export function openInGoogleMaps(start: LatLon, route: PlannedRoute) {
  const ll = (p: LatLon) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const q = [
    "api=1",
    `origin=${ll(start)}`,
    `destination=${ll(start)}`,
    `waypoints=${encodeURIComponent(route.waypoints.map(ll).join("|"))}`,
    "travelmode=walking",
  ].join("&");
  return Linking.openURL(`https://www.google.com/maps/dir/?${q}`);
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
