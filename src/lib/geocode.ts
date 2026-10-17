import type { LatLon } from "./loop";

// Address search via OpenStreetMap's Nominatim (fine for a prototype; it
// asks for at most one request per second and an identifying User-Agent).
export async function geocode(query: string): Promise<{ point: LatLon; label: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": "just10k/1.0 (walking loop planner)" } }
  );
  if (!res.ok) return null;
  const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!hit) return null;
  return {
    point: [Number(hit.lat), Number(hit.lon)],
    label: hit.display_name.split(",").slice(0, 2).join(","),
  };
}
