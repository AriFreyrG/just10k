# just10k

Get your 10,000 steps without walking the same loop again. just10k takes
your location and plans a fresh walking loop sized to the steps you have
left today.

This is the **web prototype**: a mobile-friendly page for trying the idea
on real walks before building the native iPhone/Android and watch apps.

## What it does

- **Steps → distance**: estimates stride from your height (or set your
  stride directly), so 10,000 steps ≈ 7 km for most people.
- **Top-up mode**: enter what you've already walked today and it plans
  only the remainder.
- **Three loop options + Shuffle**: each one starts and ends at your
  location, lands within ~5% of the target, and is ranked down if it
  doubles back on the same streets.
- **Walk mode**: turn-by-turn instructions, a GPS step estimate,
  progress bar, buzz before turns (Android), screen kept awake, and
  **Re-plan the rest** if you wander off the route. It still brings you
  home at about the target.
- **Export**: open the loop in Google Maps or download a GPX file to load
  on a Garmin or other watch.

## Run it

```sh
npm start          # serves on http://localhost:8000
npm test           # unit tests for the loop planner
```

Geolocation only works on `https://` or `localhost`, so to try it on
your phone, use the GitHub Pages deploy (below) or any HTTPS host.

Handy URL parameters:

- `?demo=1`: adds a **Simulate walk** button that replays the route at
  10× speed, so you can try walk mode from your desk.
- `?lat=51.5072&lon=-0.1276`: start from a fixed point instead of GPS.
- `?osrm=https://your-osrm-server/routed-foot`: use a different OSRM
  server.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the tests and publishes the site on
every push to `main`. One-time setup: in the repo, **Settings → Pages →
Build and deployment → Source: GitHub Actions**. The app is then at
`https://<user>.github.io/just10k/`.

## How loops are planned

`js/loop.js` places 3–4 waypoints around a circle that passes through
your start point, with a random rotation, direction and jitter (from a
seed, so each Shuffle gives a new shape). It asks the router for a
walking route through them and back to start, then scales the circle by
`target / actual` until the distance is within 5% (usually 1–3 tries).
Several seeds run in parallel; routes are scored on distance error plus
how much of the route walks a street twice.

Routing uses the free OSRM foot-routing server at
`routing.openstreetmap.de`, with OpenStreetMap tiles and Nominatim for
address search. These public services are fine for a prototype but are
rate-limited; a real app should self-host OSRM/GraphHopper or use a paid
provider.

## Known prototype limits

- Steps are **estimated from GPS distance**. The browser can't read Apple
  Health / Health Connect; the native app will.
- No watch app yet; use GPX export for now.
- iPhone doesn't support vibration from the web, so no turn buzz there.
