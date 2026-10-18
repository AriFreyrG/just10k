# just10k

Get your 10,000 steps without walking the same loop again. just10k takes
your location and plans a fresh walking loop sized to the steps you have
left today.

An Expo (React Native) app for iPhone and Android. The earlier web
prototype lives on the `web-prototype` branch.

## Design

The UI follows the **[just10k UI](https://claude.ai/artifact/LmbKPaG5n23bGpCdyWZ7fT)**
design canvas: four phone screens (Steps left, Pick a loop, Walking, Done).
It builds on the directions in
**[just10k design ideas](https://claude.ai/artifact/56T2feuU2Er8qVdqfucbNv)**.
Colours and fonts (Bricolage Grotesque for numbers and headings, Figtree
for text) live in `src/theme.ts`.

## What it does

- **Knows what's left.** On iPhone it reads today's step count from the
  phone and plans only the remainder. On Android you type it in for now.
- **Steps to distance.** It estimates stride from your height, or you can
  set your stride directly. For most people 10,000 steps is about 7 km.
- **Three loop options plus Shuffle.** Each loop starts and ends where
  you are and lands within about 5% of the target. Loops that double
  back on the same streets are ranked lower.
- **Walk mode.** Turn-by-turn directions with a buzz before each turn, a
  live step count from the phone's pedometer, a progress bar, and the
  screen kept on. If you go off route, **Re-plan the rest** plans a new
  way home that still adds up to about your goal.
- **Export.** Open the loop in Google Maps, or share it as a GPX file
  for a Garmin, Strava and so on.

## Try it on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. On your computer, with Node 20+:
   ```sh
   npm install
   npm start
   ```
3. Scan the QR code: with the Camera app on iPhone, or from inside Expo
   Go on Android. Your phone and computer need to be on the same wifi;
   if they aren't, run `npx expo start --tunnel`.

In development builds the pick-a-loop screen has a **Simulate walk** button
that replays the route at 10× speed, so you can try walk mode at your desk.

## Checks

```sh
npm test           # planner, walk tracker and a full-screen smoke test
npm run typecheck
npm run lint
```

## Layout

| Path | What |
| --- | --- |
| `src/app/index.tsx` | The one screen: a map with the four phases (setup, pick, walk, done) drawn over it |
| `src/components/SetupScreen.tsx` | Steps left, with the settings, start-point and set-time sheets |
| `src/components/PickOverlay.tsx` | Swipeable loop cards over the map |
| `src/components/WalkOverlay.tsx` | Turn card and step progress during a walk |
| `src/components/DoneScreen.tsx` | The finished loop as a stamp |
| `src/components/ui.tsx` | Buttons, pills, sheets and icons |
| `src/lib/describe.ts` | Loop names and tags from street names, plus date labels |
| `src/lib/loop.ts` | Loop planning and geometry (pure, unit-tested) |
| `src/lib/walk.ts` | Follows you along the route from GPS fixes (pure, unit-tested) |
| `src/lib/osrm.ts` | Walking routes from OSRM |
| `src/lib/steps.ts` | Phone pedometer |
| `src/hooks/useWalk.ts` | Wires GPS, pedometer, haptics and keep-awake into a walk |

## How loops are planned

`src/lib/loop.ts` places 3 or 4 waypoints around a circle that passes
through your start point, with a random rotation, direction and jitter.
These come from a seed, so each Shuffle gives a new shape. It asks the
router for a walking route through the waypoints and back to the start,
then scales the circle by `target / actual` until the distance is within
5%, usually in 1 to 3 tries. Several seeds run in parallel. Each route
is scored on its distance error plus how much of it walks a street twice.

Routing uses the free OSRM foot-routing server at
`routing.openstreetmap.de`, and address search uses OpenStreetMap's
Nominatim. Both are fine for a prototype but rate-limited; a released
app should self-host OSRM/GraphHopper or use a paid provider.

## Ads

A non-personalized Google AdMob banner shows on the Done screen (never during a
walk). `src/lib/ads.ts` runs Google's consent form where the law needs it, then
starts the SDK. The SDK needs a development or store build; in Expo Go the app
runs without ads.

The iOS AdMob app ID is in the `react-native-google-mobile-ads` plugin in
`app.json` (the Android one is still Google's sample). The banner's ad unit ID
comes from the `EXPO_PUBLIC_ADMOB_BANNER_IOS` EAS environment variable, set for
`production`. Development builds use Google's test ads; a release build without
the variable shows no ads.

## Known limits and next steps

- **Screen-on tracking only.** Expo Go apps can't track location in the
  background, so the screen stays awake during a walk. Background
  tracking needs a development build plus `expo-task-manager`.
- **Android step history.** Reading today's steps on Android needs Health
  Connect, which isn't available in Expo Go. A development build with
  `react-native-health-connect` would add it, and Apple HealthKit on iPhone.
- **Watches.** There's no watch app yet; use GPX export for now. An Apple
  Watch app needs native watchOS code; Wear OS and Garmin Connect IQ are
  separate projects too.
- **Android maps in store builds.** `react-native-maps` uses Google Maps
  on Android. Expo Go works without setup, but your own builds need a
  Google Maps API key in `app.json` (`android.config.googleMaps.apiKey`).
