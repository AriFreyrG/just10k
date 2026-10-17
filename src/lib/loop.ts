// Pure geometry + loop planning. No DOM, so it runs in Node tests too.
// Points are [lat, lon] arrays throughout.

export type LatLon = [number, number];

export type TurnStep = {
  location: LatLon;
  text: string;
  distance: number;
};

export type RouteResult = {
  distance: number;
  coords: LatLon[];
  steps: TurnStep[];
};

export type PlannedRoute = RouteResult & {
  overlap: number;
  waypoints: LatLon[];
  error: number;
  seed?: number;
};

export type Router = (points: LatLon[]) => Promise<RouteResult>;

type Shape = {
  bearing: number;
  clockwise: boolean;
  jitter: { angle: number; radius: number }[];
};

const EARTH_R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversine([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function bearing([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x =
    Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function destination([lat, lon]: LatLon, bearingDeg: number, distM: number): LatLon {
  const d = distM / EARTH_R;
  const b = rad(bearingDeg);
  const la1 = rad(lat);
  const lo1 = rad(lon);
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b)
  );
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2)
    );
  return [deg(la2), ((deg(lo2) + 540) % 360) - 180];
}

// Small seeded PRNG so a "seed" reproduces the same loop.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const strideFromHeight = (heightCm: number) => (heightCm * 0.414) / 100;
export const stepsToMeters = (steps: number, strideM: number) => steps * strideM;
export const metersToSteps = (m: number, strideM: number) => Math.round(m / strideM);
// ~100 steps/minute is a typical brisk-ish walking cadence.
export const stepsToMinutes = (steps: number) => Math.round(steps / 100);

export function pathLength(coords: LatLon[]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i]);
  return d;
}

// Fraction of the route's length that walks a street segment it already
// walked (out-and-back spurs, doubling back). 0 = clean loop.
export function overlapRatio(coords: LatLon[]): number {
  const key = (p: LatLon) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const seen = new Set<string>();
  let total = 0;
  let repeated = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = key(coords[i - 1]);
    const b = key(coords[i]);
    const len = haversine(coords[i - 1], coords[i]);
    total += len;
    if (a === b) continue;
    const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(edge)) repeated += len;
    else seen.add(edge);
  }
  return total ? repeated / total : 0;
}

// Waypoints spaced around a circle that passes through `start`. `shape`
// holds per-waypoint angle/radius jitter so scaling the radius keeps the
// same overall shape between iterations.
export function loopWaypoints(start: LatLon, radiusM: number, shape: Shape): LatLon[] {
  const center = destination(start, shape.bearing, radiusM);
  const back = (shape.bearing + 180) % 360; // direction center -> start
  const n = shape.jitter.length;
  const dir = shape.clockwise ? 1 : -1;
  return shape.jitter.map(({ angle, radius }, i) => {
    const a = back + dir * ((360 / (n + 1)) * (i + 1) + angle);
    return destination(center, a, radiusM * radius);
  });
}

function randomShape(rand: () => number): Shape {
  const n = rand() < 0.5 ? 3 : 4;
  return {
    bearing: rand() * 360,
    clockwise: rand() < 0.5,
    jitter: Array.from({ length: n }, () => ({
      angle: (rand() - 0.5) * 30,
      radius: 0.85 + rand() * 0.3,
    })),
  };
}

// Score: distance error plus a penalty for doubled-back street segments.
export const scoreRoute = (route: PlannedRoute, targetM: number) =>
  Math.abs(route.distance - targetM) / targetM + route.overlap * 1.5;

/**
 * Plan one loop from `start` of roughly `targetM` meters.
 * `router(points)` resolves to { distance, coords, steps }.
 */
type LoopArgs = {
  start: LatLon;
  targetM: number;
  router: Router;
  seed: number;
  tolerance?: number;
  maxIter?: number;
};

export async function planLoop({ start, targetM, router, seed, tolerance = 0.05, maxIter = 4 }: LoopArgs): Promise<PlannedRoute> {
  const rand = mulberry32(seed);
  const shape = randomShape(rand);
  // Streets are rarely straight: real walking distance runs ~1.3x the circle.
  let radius = targetM / (2 * Math.PI * 1.3);
  let best: PlannedRoute | null = null;
  for (let i = 0; i < maxIter; i++) {
    const waypoints = loopWaypoints(start, radius, shape);
    const result = await router([start, ...waypoints, start]);
    const route: PlannedRoute = {
      ...result,
      overlap: overlapRatio(result.coords),
      waypoints,
      seed,
      error: (result.distance - targetM) / targetM,
    };
    if (!best || Math.abs(route.error) < Math.abs(best.error)) best = route;
    if (Math.abs(route.error) <= tolerance) break;
    radius *= Math.min(2, Math.max(0.5, targetM / route.distance));
  }
  return best!;
}

// Plan several loops with different seeds, best-scoring first.
export async function planOptions({
  start,
  targetM,
  router,
  count = 3,
  seed = Date.now(),
}: Omit<LoopArgs, "seed"> & { count?: number; seed?: number }): Promise<PlannedRoute[]> {
  const seeds = Array.from({ length: count }, (_, i) => (seed + i * 7919) >>> 0);
  const settled = await Promise.allSettled(
    seeds.map((s) => planLoop({ start, targetM, router, seed: s }))
  );
  const routes = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!routes.length) throw (settled[0] as PromiseRejectedResult).reason;
  return routes.sort((a, b) => scoreRoute(a, targetM) - scoreRoute(b, targetM));
}

/**
 * Route from `from` to `to` that is roughly `targetM` long, by bending the
 * path through two waypoints on an ellipse whose foci are the endpoints.
 * Used to re-plan the rest of a walk after going off route.
 */
export async function planDetour({
  from,
  to,
  targetM,
  router,
  seed = Date.now(),
  tolerance = 0.07,
  maxIter = 4,
}: {
  from: LatLon;
  to: LatLon;
  targetM: number;
  router: Router;
  seed?: number;
  tolerance?: number;
  maxIter?: number;
}): Promise<PlannedRoute> {
  const directResult = await router([from, to]);
  const direct: PlannedRoute = {
    ...directResult,
    overlap: overlapRatio(directResult.coords),
    waypoints: [],
    error: (directResult.distance - targetM) / targetM,
  };
  if (direct.distance >= targetM * (1 - tolerance)) return direct;

  const rand = mulberry32(seed);
  const side = rand() < 0.5 ? 1 : -1;
  const axis = bearing(from, to);
  const mid = destination(from, axis, haversine(from, to) / 2);
  const c = haversine(from, to) / 2;
  let sum = targetM / 1.3; // |PA| + |PB| for points on the ellipse
  let best = direct;
  for (let i = 0; i < maxIter; i++) {
    const a = Math.max(sum / 2, c + 1);
    const b = Math.sqrt(a * a - c * c);
    // Two points on one side of the ellipse at parametric angles 60° and 120°.
    const waypoints = [60, 120].map((t) => {
      const x = a * Math.cos(rad(t)); // along axis
      const y = b * Math.sin(rad(t)) * side; // across axis
      const along = destination(mid, axis, x);
      return destination(along, axis + 90, y);
    });
    const result = await router([from, ...waypoints, to]);
    const route: PlannedRoute = {
      ...result,
      overlap: overlapRatio(result.coords),
      waypoints,
      error: (result.distance - targetM) / targetM,
    };
    if (Math.abs(route.error) < Math.abs(best.error)) best = route;
    if (Math.abs(route.error) <= tolerance) break;
    sum *= Math.min(2, Math.max(0.5, targetM / route.distance));
  }
  return best;
}

// Cumulative distance along a polyline, for progress tracking.
export function cumulative(coords: LatLon[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

/**
 * Locate `pos` on the route, searching forward from the last known index so
 * a loop's shared start/end point doesn't make progress jump to 100%.
 * Returns { index, offRouteM }.
 */
export function locateOnRoute(coords: LatLon[], cum: number[], pos: LatLon, lastIndex = 0, windowM = 500) {
  let bestI = lastIndex;
  let bestD = Infinity;
  const from = Math.max(0, lastIndex - 5);
  const limit = cum[lastIndex] + windowM;
  for (let i = from; i < coords.length && cum[i] <= limit; i++) {
    const d = haversine(coords[i], pos);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return { index: Math.max(bestI, lastIndex), offRouteM: bestD };
}

export function toGpx(coords: LatLon[], name = "just10k walk"): string {
  const pts = coords
    .map(([lat, lon]) => `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`)
    .join("\n      ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="just10k" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
      ${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
