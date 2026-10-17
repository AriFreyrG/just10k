// OSRM foot-routing client. The default server is the free FOSSGIS instance
// (routing.openstreetmap.de): fine for a prototype, but it's rate-limited
// and has no SLA, so a real app should self-host or use a paid provider.

export const DEFAULT_OSRM = "https://routing.openstreetmap.de/routed-foot";

export function osrmRouter(base = DEFAULT_OSRM) {
  return async (points) => {
    const coords = points.map(([lat, lon]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(";");
    const url = `${base}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Routing server returned ${res.status}`);
    const json = await res.json();
    if (json.code !== "Ok") throw new Error(json.message || json.code);
    const route = json.routes[0];
    const legs = route.legs;
    const steps = legs.flatMap((leg, li) =>
      leg.steps
        // Drop the arrive/depart pairs OSRM inserts at each via-waypoint.
        .filter((s) => {
          const t = s.maneuver.type;
          if (t === "depart") return li === 0;
          if (t === "arrive") return li === legs.length - 1;
          return true;
        })
        .map((s) => ({
          location: [s.maneuver.location[1], s.maneuver.location[0]],
          text: describe(s),
          distance: s.distance,
        }))
    );
    return {
      distance: route.distance,
      coords: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      steps,
    };
  };
}

function describe(step) {
  const { type, modifier } = step.maneuver;
  const road = step.name || "the path";
  if (type === "depart") return `Head out on ${road}`;
  if (type === "arrive") return "You're back. Nice walk!";
  if (type === "roundabout" || type === "rotary") return `At the roundabout, take ${road}`;
  if (!modifier || modifier === "straight") return `Continue on ${road}`;
  if (modifier === "uturn") return `Turn around on ${road}`;
  // "slight left" -> "Slight left onto X", "left" -> "Turn left onto X"
  const verb = modifier.includes(" ") ? modifier[0].toUpperCase() + modifier.slice(1) : `Turn ${modifier}`;
  return `${verb} onto ${road}`;
}
