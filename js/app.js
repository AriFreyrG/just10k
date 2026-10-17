import {
  haversine,
  strideFromHeight,
  stepsToMeters,
  metersToSteps,
  stepsToMinutes,
  planOptions,
  planDetour,
  cumulative,
  locateOnRoute,
  toGpx,
} from "./loop.js";
import { osrmRouter } from "./router.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const router = osrmRouter(params.get("osrm") || undefined);
const COLORS = ["#0f766e", "#7c3aed", "#ea580c"];
const OFF_ROUTE_M = 50;

const state = {
  start: null, // [lat, lon]
  options: [],
  selected: 0,
  walk: null,
};

// ---------- settings (remembered per device) ----------

const today = () => new Date().toISOString().slice(0, 10);
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("just10k") || "{}");
    if (s.goal) $("goal").value = s.goal;
    if (s.height) $("height").value = s.height;
    if (s.stride) $("stride").value = s.stride;
    if (s.doneDate === today() && s.done) $("done").value = s.done;
  } catch {}
}
function saveSettings() {
  try {
    localStorage.setItem(
      "just10k",
      JSON.stringify({
        goal: $("goal").value,
        height: $("height").value,
        stride: $("stride").value,
        done: $("done").value,
        doneDate: today(),
      })
    );
  } catch {}
}

const strideM = () => {
  const s = Number($("stride").value);
  return s > 0 ? s / 100 : strideFromHeight(Number($("height").value) || 170);
};
const stepsToWalk = () => Math.max(500, (Number($("goal").value) || 10000) - (Number($("done").value) || 0));
const km = (m) => (m / 1000).toFixed(1);
const fmt = (n) => n.toLocaleString();

function updateSummary() {
  const steps = stepsToWalk();
  const m = stepsToMeters(steps, strideM());
  $("setup-summary").innerHTML =
    `Walk <strong>${fmt(steps)}</strong> steps ≈ <strong>${km(m)} km</strong>, about ${stepsToMinutes(steps)} min`;
  saveSettings();
}

// ---------- map ----------

const map = L.map("map", { zoomControl: false }).setView([20, 0], 2);
L.control.zoom({ position: "topright" }).addTo(map);
// The panel height changes per view, which resizes the map.
new ResizeObserver(() => map.invalidateSize()).observe($("map"));
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

let startMarker = null;
let routeLayers = [];
let meMarker = null;

function setStart(latlng, label) {
  state.start = latlng;
  $("start-label").textContent = label;
  $("plan").disabled = false;
  if (startMarker) startMarker.setLatLng(latlng);
  else
    startMarker = L.circleMarker(latlng, {
      radius: 9,
      color: "#fff",
      weight: 3,
      fillColor: "#0f766e",
      fillOpacity: 1,
    }).addTo(map);
  map.setView(latlng, Math.max(map.getZoom(), 15));
}

map.on("click", (e) => {
  if (!$("view-setup").hidden) setStart([e.latlng.lat, e.latlng.lng], "Start: dropped pin");
});

function locate() {
  if (!navigator.geolocation) {
    $("start-label").textContent = "Location unavailable — tap the map or search.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => setStart([p.coords.latitude, p.coords.longitude], "Start: your location"),
    () => ($("start-label").textContent = "Location blocked — tap the map or search."),
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

$("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("search").value.trim();
  if (!q) return;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    );
    const [hit] = await res.json();
    if (!hit) throw new Error("No match");
    setStart([Number(hit.lat), Number(hit.lon)], `Start: ${hit.display_name.split(",").slice(0, 2).join(",")}`);
    $("search").blur();
  } catch {
    $("setup-error").textContent = "Couldn't find that address.";
  }
});

// ---------- views ----------

function show(view) {
  for (const v of ["setup", "results", "walk", "done"]) $(`view-${v}`).hidden = v !== view;
}

function clearRoutes() {
  routeLayers.forEach((l) => l.remove());
  routeLayers = [];
}

function drawOptions() {
  clearRoutes();
  const stride = strideM();
  // Draw unselected first so the selected loop sits on top.
  const order = state.options.map((_, i) => i).sort((a, b) => (a === state.selected) - (b === state.selected));
  for (const i of order) {
    const sel = i === state.selected;
    const line = L.polyline(state.options[i].coords, {
      color: COLORS[i % COLORS.length],
      weight: sel ? 6 : 4,
      opacity: sel ? 0.95 : 0.35,
    })
      .on("click", () => select(i))
      .addTo(map);
    routeLayers.push(line);
  }
  const sel = state.options[state.selected];
  $("options").innerHTML = state.options
    .map((r, i) => {
      const steps = metersToSteps(r.distance, stride);
      const flag = r.overlap > 0.15 ? `<span class="flag">some doubling back</span>` : "";
      return `<button class="option${i === state.selected ? " selected" : ""}" role="radio"
        aria-checked="${i === state.selected}" data-i="${i}" style="--c:${COLORS[i % COLORS.length]}">
        <span class="swatch"></span>
        <span class="opt-main"><strong>${fmt(steps)}</strong> steps</span>
        <span class="opt-sub">${km(r.distance)} km · ${stepsToMinutes(steps)} min ${flag}</span>
      </button>`;
    })
    .join("");
  $("options").querySelectorAll(".option").forEach((b) => b.addEventListener("click", () => select(Number(b.dataset.i))));
  $("gmaps").href = googleMapsUrl(sel);
  // The option cards just changed the panel height, so resize before fitting.
  map.invalidateSize();
  map.fitBounds(L.latLngBounds(sel.coords), { padding: [30, 30] });
}

function select(i) {
  state.selected = i;
  drawOptions();
}

function googleMapsUrl(route) {
  const ll = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", ll(state.start));
  u.searchParams.set("destination", ll(state.start));
  u.searchParams.set("waypoints", route.waypoints.map(ll).join("|"));
  u.searchParams.set("travelmode", "walking");
  return u.toString();
}

async function plan() {
  if (!state.start) return;
  const btns = [$("plan"), $("shuffle")];
  btns.forEach((b) => (b.disabled = true));
  const label = $("plan").textContent;
  $("plan").textContent = "Finding loops…";
  $("shuffle").textContent = "Shuffling…";
  $("setup-error").textContent = "";
  try {
    const targetM = stepsToMeters(stepsToWalk(), strideM());
    state.options = await planOptions({
      start: state.start,
      targetM,
      router,
      seed: Math.floor(Math.random() * 2 ** 31),
    });
    state.selected = 0;
    $("results-target").textContent = `Target: ${fmt(stepsToWalk())} steps`;
    show("results");
    drawOptions();
  } catch (err) {
    show("setup");
    $("setup-error").textContent = `Couldn't plan a route: ${err.message}. Try again in a moment.`;
  } finally {
    btns.forEach((b) => (b.disabled = false));
    $("plan").textContent = label;
    $("shuffle").textContent = "Shuffle";
  }
}

// ---------- walking ----------

function startWalk({ simulate = false } = {}) {
  const route = state.options[state.selected];
  clearRoutes();
  routeLayers.push(L.polyline(route.coords, { color: COLORS[state.selected % COLORS.length], weight: 6 }).addTo(map));
  state.walk = {
    route,
    cum: cumulative(route.coords),
    stepAt: [],
    index: 0,
    odometer: 0,
    lastPos: null,
    offCount: 0,
    buzzed: new Set(),
    goalM: stepsToMeters(stepsToWalk(), strideM()),
    watchId: null,
    timer: null,
    wakeLock: null,
  };
  indexSteps(state.walk);
  show("walk");
  $("offroute").hidden = true;
  updateWalkUi();

  navigator.wakeLock?.request("screen").then((l) => (state.walk && (state.walk.wakeLock = l))).catch(() => {});

  if (simulate) simulateWalk(route);
  else if (navigator.geolocation)
    state.walk.watchId = navigator.geolocation.watchPosition(
      (p) => onPosition([p.coords.latitude, p.coords.longitude], p.coords.accuracy),
      () => ($("next-text").textContent = "Waiting for GPS…"),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
}

// Find how far along the route each turn instruction sits.
function indexSteps(walk) {
  let i = 0;
  walk.stepAt = walk.route.steps.map((s) => {
    let best = i;
    let bestD = Infinity;
    for (let j = i; j < walk.route.coords.length; j++) {
      const d = haversine(walk.route.coords[j], s.location);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
      if (d < 1) break;
    }
    i = best;
    return walk.cum[best];
  });
}

function onPosition(pos, accuracy = 10) {
  const w = state.walk;
  if (!w) return;
  if (meMarker) meMarker.setLatLng(pos);
  else
    meMarker = L.circleMarker(pos, { radius: 8, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map);

  // GPS odometer, ignoring jitter smaller than the fix's accuracy.
  if (w.lastPos && accuracy < 50) {
    const d = haversine(w.lastPos, pos);
    if (d > Math.max(3, accuracy * 0.5)) {
      w.odometer += d;
      w.lastPos = pos;
    }
  } else if (!w.lastPos) w.lastPos = pos;

  const { index, offRouteM } = locateOnRoute(w.route.coords, w.cum, pos, w.index);
  w.offCount = offRouteM > OFF_ROUTE_M ? w.offCount + 1 : 0;
  if (offRouteM <= OFF_ROUTE_M) w.index = index;
  $("offroute").hidden = w.offCount < 2;
  updateWalkUi();
  map.panTo(pos, { animate: true });

  const total = w.cum[w.cum.length - 1];
  if (w.cum[w.index] > total - 25 && w.odometer > total * 0.6) finishWalk();
}

function updateWalkUi() {
  const w = state.walk;
  const stride = strideM();
  const progress = w.cum[w.index];
  const total = w.cum[w.cum.length - 1];
  const nextI = w.stepAt.findIndex((at) => at > progress + 5);
  if (nextI >= 0) {
    const dist = w.stepAt[nextI] - progress;
    $("next-text").textContent = w.route.steps[nextI].text;
    $("next-dist").textContent = `in ${dist < 1000 ? `${Math.round(dist / 10) * 10} m` : `${km(dist)} km`}`;
    if (dist < 30 && !w.buzzed.has(nextI)) {
      w.buzzed.add(nextI);
      navigator.vibrate?.([120, 80, 120]);
    }
  }
  const walked = metersToSteps(w.odometer, stride);
  $("walked-steps").textContent = fmt(walked);
  $("total-steps").textContent = fmt(walked + (Number($("done").value) || 0));
  $("remaining").textContent = km(Math.max(0, total - progress));
  $("progress-bar").style.width = `${Math.min(100, (w.odometer / w.goalM) * 100)}%`;
}

async function replan() {
  const w = state.walk;
  if (!w?.lastPos) return;
  $("replan").disabled = true;
  $("replan").textContent = "Re-planning…";
  try {
    const route = await planDetour({
      from: w.lastPos,
      to: state.start,
      targetM: Math.max(200, w.goalM - w.odometer),
      router,
    });
    w.route = route;
    w.cum = cumulative(route.coords);
    w.index = 0;
    w.offCount = 0;
    w.buzzed.clear();
    indexSteps(w);
    clearRoutes();
    routeLayers.push(L.polyline(route.coords, { color: COLORS[0], weight: 6 }).addTo(map));
    $("offroute").hidden = true;
    updateWalkUi();
  } catch (err) {
    $("next-text").textContent = `Re-plan failed: ${err.message}`;
  } finally {
    $("replan").disabled = false;
    $("replan").textContent = "Re-plan the rest";
  }
}

function stopTracking() {
  const w = state.walk;
  if (!w) return;
  if (w.watchId != null) navigator.geolocation.clearWatch(w.watchId);
  clearInterval(w.timer);
  w.wakeLock?.release?.().catch(() => {});
}

function finishWalk() {
  const w = state.walk;
  stopTracking();
  const walked = metersToSteps(w.odometer, strideM());
  const newDone = (Number($("done").value) || 0) + walked;
  $("done").value = newDone;
  saveSettings();
  $("done-summary").textContent = `About ${fmt(walked)} steps (${km(w.odometer)} km) this walk — ${fmt(newDone)} today.`;
  state.walk = null;
  show("done");
}

// Demo mode (?demo=1): replay the route at ~10x walking speed, so the walk
// screen can be tried from a desk.
function simulateWalk(route) {
  const cum = cumulative(route.coords);
  let m = 0;
  state.walk.timer = setInterval(() => {
    m += 14; // ~1.4 m/s * 10
    let i = cum.findIndex((c) => c >= m);
    if (i < 0) i = cum.length - 1;
    onPosition(route.coords[i], 5);
    if (m >= cum[cum.length - 1] + 30) clearInterval(state.walk?.timer);
  }, 1000);
}

// ---------- wiring ----------

["goal", "done", "height", "stride"].forEach((id) => $(id).addEventListener("input", updateSummary));
$("plan").addEventListener("click", plan);
$("shuffle").addEventListener("click", plan);
$("back").addEventListener("click", () => {
  clearRoutes();
  show("setup");
});
$("start").addEventListener("click", () => startWalk());
$("simulate").addEventListener("click", () => startWalk({ simulate: true }));
$("simulate").hidden = !params.has("demo");
$("replan").addEventListener("click", replan);
$("end").addEventListener("click", finishWalk);
$("again").addEventListener("click", () => {
  meMarker?.remove();
  meMarker = null;
  clearRoutes();
  if (state.start) map.setView(state.start, 15);
  show("setup");
  updateSummary();
});
$("gpx").addEventListener("click", () => {
  const route = state.options[state.selected];
  const blob = new Blob([toGpx(route.coords)], { type: "application/gpx+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `just10k-${today()}.gpx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

loadSettings();
updateSummary();
if (params.has("lat") && params.has("lon")) setStart([Number(params.get("lat")), Number(params.get("lon"))], "Start: from link");
else locate();
