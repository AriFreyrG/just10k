import type { LatLon, PlannedRoute } from "./loop";

// A name and a few honest tags for a planned loop, from what the router tells
// us: the streets it follows and how much of it doubles back.

export function loopName(route: PlannedRoute, fallback: string): string {
  const byRoad = new Map<string, number>();
  for (const s of route.steps) {
    if (s.road) byRoad.set(s.road, (byRoad.get(s.road) ?? 0) + s.distance);
  }
  const top = [...byRoad.entries()].sort((a, b) => b[1] - a[1]).map(([road]) => road);
  if (top.length >= 2) return `${top[0]} & ${top[1]}`;
  if (top.length === 1) return `Via ${top[0]}`;
  return fallback;
}

export function loopTags(route: PlannedRoute): string[] {
  const tags: string[] = [];
  const total = route.steps.reduce((d, s) => d + s.distance, 0);
  const unnamed = route.steps.filter((s) => !s.road).reduce((d, s) => d + s.distance, 0);
  if (total > 0 && unnamed / total > 0.4) tags.push("Mostly paths");
  tags.push(route.overlap > 0.15 ? "Some doubling back" : route.overlap < 0.05 ? "No doubling back" : "Little doubling back");
  const turns = route.steps.filter((s) => s.turn && s.turn !== "straight").length;
  const perKm = turns / Math.max(0.5, route.distance / 1000);
  if (perKm < 4) tags.push("Few turns");
  else if (perKm > 10) tags.push("Lots of turns");
  return tags;
}

// "Saturday afternoon"
export function dayPart(d = new Date()): string {
  const day = d.toLocaleDateString("en-GB", { weekday: "long" });
  const h = d.getHours();
  const part = h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night";
  return `${day} ${part}`;
}

// "Sat 17 Oct"
export const shortDate = (d = new Date()) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");

// Project a route into a w×h box (keeping its proportions) for drawing it as a shape.
export function routeShape(coords: LatLon[], w: number, h: number, pad = 0): { x: number; y: number }[] {
  if (!coords.length) return [];
  const midLat = coords.reduce((a, [lat]) => a + lat, 0) / coords.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const pts = coords.map(([lat, lon]) => ({ x: lon * k, y: -lat }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  return pts.map((p) => ({ x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale }));
}
