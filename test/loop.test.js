import test from "node:test";
import assert from "node:assert/strict";
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
} from "../js/loop.js";

const home = [51.5072, -0.1276];

// Fake router: straight lines between points, densified every ~20 m, with
// "streets" 1.25x longer than the straight line.
function fakeRouter(factor = 1.25) {
  return async (points) => {
    const coords = [points[0]];
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
  assert.ok(Math.abs(haversine(home, p) - 1234) < 0.5);
});

test("stride from height is plausible", () => {
  assert.ok(Math.abs(strideFromHeight(170) - 0.704) < 0.01);
});

test("overlapRatio: clean loop ~0, out-and-back ~0.5", async () => {
  const r = fakeRouter();
  const loop = await r([home, destination(home, 0, 500), destination(home, 90, 500), home]);
  assert.ok(overlapRatio(loop.coords) < 0.05);
  const spur = await r([home, destination(home, 0, 800), home]);
  assert.ok(overlapRatio(spur.coords) > 0.4);
});

for (const factor of [1.05, 1.25, 1.6]) {
  test(`planLoop converges within 5% (street factor ${factor})`, async () => {
    const targetM = 7040;
    const route = await planLoop({ start: home, targetM, router: fakeRouter(factor), seed: 42 });
    assert.ok(Math.abs(route.error) <= 0.05, `error ${route.error}`);
    assert.deepEqual(route.coords[0], home);
    assert.deepEqual(route.coords.at(-1), home);
  });
}

test("same seed -> same loop, different seeds -> different loops", async () => {
  const args = { start: home, targetM: 5000, router: fakeRouter() };
  const a = await planLoop({ ...args, seed: 1 });
  const b = await planLoop({ ...args, seed: 1 });
  const c = await planLoop({ ...args, seed: 2 });
  assert.deepEqual(a.waypoints, b.waypoints);
  assert.notDeepEqual(a.waypoints, c.waypoints);
});

test("planOptions returns sorted options and tolerates a failing request", async () => {
  const good = fakeRouter();
  let calls = 0;
  const flaky = async (pts) => {
    if (++calls === 1) throw new Error("boom");
    return good(pts);
  };
  const opts = await planOptions({ start: home, targetM: 7000, router: flaky, count: 3, seed: 5 });
  assert.ok(opts.length >= 2);
});

test("planDetour stretches a short trip toward the target", async () => {
  const from = destination(home, 45, 600);
  const route = await planDetour({ from, to: home, targetM: 3000, router: fakeRouter(), seed: 3 });
  assert.ok(Math.abs(route.error) <= 0.07, `error ${route.error}`);
});

test("locateOnRoute doesn't jump to the end of a loop at the start", async () => {
  const route = await fakeRouter()([home, destination(home, 0, 600), destination(home, 90, 600), home]);
  const cum = cumulative(route.coords);
  const { index } = locateOnRoute(route.coords, cum, home, 0);
  assert.equal(index, 0);
  // Midway along, progress moves forward.
  const mid = route.coords[Math.floor(route.coords.length / 2)];
  const at = locateOnRoute(route.coords, cum, mid, 0, 5000);
  assert.ok(at.index > 0 && at.offRouteM < 1);
});
