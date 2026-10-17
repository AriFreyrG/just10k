import { destination, type LatLon, type PlannedRoute } from "../loop";
import { WalkTracker } from "../walk";

const home: LatLon = [51.5072, -0.1276];
const north = destination(home, 0, 400);
const east = destination(north, 90, 400);

// A 400 m x 400 m triangle-ish loop, densified every ~10 m.
function makeRoute(): PlannedRoute {
  const corners = [home, north, east, home];
  const coords: LatLon[] = [home];
  for (let c = 1; c < corners.length; c++) {
    const [a, b] = [corners[c - 1], corners[c]];
    for (let k = 1; k <= 40; k++) coords.push([a[0] + ((b[0] - a[0]) * k) / 40, a[1] + ((b[1] - a[1]) * k) / 40]);
  }
  return {
    distance: 0,
    coords,
    steps: [
      { location: home, text: "Head out on Long Rd", distance: 0 },
      { location: north, text: "Turn right onto Park Rd", distance: 0 },
      { location: east, text: "Turn right onto Mill Ln", distance: 0 },
      { location: home, text: "You're back. Nice walk!", distance: 0 },
    ],
    overlap: 0,
    waypoints: [north, east],
    error: 0,
  };
}

test("walking the whole loop tracks progress, warns before turns and finishes", () => {
  const route = makeRoute();
  const t = new WalkTracker(route);
  expect(t.nextTurn?.text).toBe("Turn right onto Park Rd");
  let warnings = 0;
  for (const p of route.coords) if (t.update(p, 5)) warnings++;
  expect(warnings).toBe(3);
  expect(t.finished).toBe(true);
  expect(t.remainingM).toBeLessThan(1);
  expect(Math.abs(t.odometerM - t.totalM) / t.totalM).toBeLessThan(0.05);
});

test("standing at the start does not count as finished", () => {
  const t = new WalkTracker(makeRoute());
  t.update(home, 5);
  t.update(home, 5);
  expect(t.finished).toBe(false);
  expect(t.progressM).toBe(0);
});

test("going 100 m off route is flagged after two fixes; GPS jitter is ignored", () => {
  const t = new WalkTracker(makeRoute());
  t.update(home, 5);
  t.update(destination(home, 0, 1), 5); // 1 m of jitter
  expect(t.odometerM).toBe(0);
  const away = destination(home, 270, 100);
  t.update(away, 5);
  expect(t.offRoute).toBe(false);
  t.update(away, 5);
  expect(t.offRoute).toBe(true);
});
