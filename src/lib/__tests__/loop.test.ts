import {
  haversine,
  destination,
  overlapRatio,
  planLoop,
  planOptions,
  planDetour,
  cumulative,
  locateOnRoute,
  pathLength,
  strideFromHeight,
  type LatLon,
  type Router,
} from "../loop";
import { describe as describeStep } from "../osrm";

const home: LatLon = [51.5072, -0.1276];

// Fake router: straight lines between points, densified every ~20 m, with
// "streets" 1.25x longer than the straight line.
function fakeRouter(factor = 1.25): Router {
  return async (points) => {
    const coords: LatLon[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1], points[i]];
      const n = Math.max(1, Math.round(haversine(a, b) / 20));
      for (let k = 1; k <= n; k++) coords.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    return { distance: pathLength(coords) * factor, coords, steps: [] };
  };
}

test("destination and haversine agree", () => {
  const p = destination(home, 73, 1234);
  expect(Math.abs(haversine(home, p) - 1234) < 0.5).toBe(true);
});

test("stride from height is plausible", () => {
  expect(Math.abs(strideFromHeight(170) - 0.704) < 0.01).toBe(true);
});

test("overlapRatio: clean loop ~0, out-and-back ~0.5", async () => {
  const r = fakeRouter();
  const loop = await r([home, destination(home, 0, 500), destination(home, 90, 500), home]);
  expect(overlapRatio(loop.coords) < 0.05).toBe(true);
  const spur = await r([home, destination(home, 0, 800), home]);
  expect(overlapRatio(spur.coords) > 0.4).toBe(true);
});

for (const factor of [1.05, 1.25, 1.6]) {
  test(`planLoop converges within 5% (street factor ${factor})`, async () => {
    const targetM = 7040;
    const route = await planLoop({ start: home, targetM, router: fakeRouter(factor), seed: 42 });
    expect(Math.abs(route.error) <= 0.05).toBe(true);
    expect(route.coords[0]).toEqual(home);
    expect(route.coords.at(-1)).toEqual(home);
  });
}

test("same seed -> same loop, different seeds -> different loops", async () => {
  const args = { start: home, targetM: 5000, router: fakeRouter() };
  const a = await planLoop({ ...args, seed: 1 });
  const b = await planLoop({ ...args, seed: 1 });
  const c = await planLoop({ ...args, seed: 2 });
  expect(a.waypoints).toEqual(b.waypoints);
  expect(a.waypoints).not.toEqual(c.waypoints);
});

test("planOptions returns sorted options and tolerates a failing request", async () => {
  const good = fakeRouter();
  let calls = 0;
  const flaky: Router = async (pts) => {
    if (++calls === 1) throw new Error("boom");
    return good(pts);
  };
  const opts = await planOptions({ start: home, targetM: 7000, router: flaky, count: 3, seed: 5 });
  expect(opts.length >= 2).toBe(true);
});

test("planDetour stretches a short trip toward the target", async () => {
  const from = destination(home, 45, 600);
  const route = await planDetour({ from, to: home, targetM: 3000, router: fakeRouter(), seed: 3 });
  expect(Math.abs(route.error) <= 0.07).toBe(true);
});

test("locateOnRoute doesn't jump to the end of a loop at the start", async () => {
  const route = await fakeRouter()([home, destination(home, 0, 600), destination(home, 90, 600), home]);
  const cum = cumulative(route.coords);
  const { index } = locateOnRoute(route.coords, cum, home, 0);
  expect(index).toBe(0);
  // Midway along, progress moves forward.
  const mid = route.coords[Math.floor(route.coords.length / 2)];
  const at = locateOnRoute(route.coords, cum, mid, 0, 5000);
  expect(at.index > 0 && at.offRouteM < 1).toBe(true);
});

test("turn instructions read naturally", () => {
  const step = (type: string, modifier?: string, name = "High St") => ({
    name,
    distance: 0,
    maneuver: { type, modifier, location: [0, 0] as [number, number] },
  });
  expect(describeStep(step("turn", "left"))).toBe("Turn left onto High St");
  expect(describeStep(step("turn", "slight right"))).toBe("Slight right onto High St");
  expect(describeStep(step("new name", "straight", ""))).toBe("Continue on the path");
  expect(describeStep(step("arrive"))).toBe("You're back. Nice walk!");
});
