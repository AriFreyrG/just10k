import { cumulative, haversine, locateOnRoute, type LatLon, type PlannedRoute } from "./loop";

const OFF_ROUTE_M = 50;
const TURN_WARNING_M = 30;

// Follows the walker along a route from GPS fixes: progress, the next turn,
// whether they've strayed, and a GPS odometer for when there's no pedometer.
export class WalkTracker {
  route!: PlannedRoute;
  cum: number[] = [];
  stepAt: number[] = [];
  index = 0;
  odometerM = 0;
  lastPos: LatLon | null = null;
  private offCount = 0;
  private warned = new Set<number>();

  constructor(route: PlannedRoute) {
    this.setRoute(route);
  }

  setRoute(route: PlannedRoute) {
    this.route = route;
    this.cum = cumulative(route.coords);
    this.stepAt = indexSteps(route, this.cum);
    this.index = 0;
    this.offCount = 0;
    this.warned.clear();
  }

  /** Feed a GPS fix. Returns true when a turn is coming up (time to buzz). */
  update(pos: LatLon, accuracy = 10): boolean {
    // GPS odometer, ignoring jitter smaller than the fix's accuracy.
    if (!this.lastPos) this.lastPos = pos;
    else if (accuracy < 50) {
      const d = haversine(this.lastPos, pos);
      if (d > Math.max(3, accuracy * 0.5)) {
        this.odometerM += d;
        this.lastPos = pos;
      }
    }

    const { index, offRouteM } = locateOnRoute(this.route.coords, this.cum, pos, this.index);
    this.offCount = offRouteM > OFF_ROUTE_M ? this.offCount + 1 : 0;
    if (offRouteM <= OFF_ROUTE_M) this.index = index;

    const next = this.nextTurn;
    if (next && next.distM < TURN_WARNING_M && !this.warned.has(next.i)) {
      this.warned.add(next.i);
      return true;
    }
    return false;
  }

  get totalM() {
    return this.cum[this.cum.length - 1];
  }
  get progressM() {
    return this.cum[this.index];
  }
  get remainingM() {
    return Math.max(0, this.totalM - this.progressM);
  }
  get offRoute() {
    return this.offCount >= 2;
  }
  // Back at the end of the loop, having actually walked most of it.
  get finished() {
    return this.progressM > this.totalM - 25 && this.odometerM > this.totalM * 0.6;
  }
  get nextTurn(): { i: number; text: string; distM: number } | null {
    const i = this.stepAt.findIndex((at) => at > this.progressM + 5);
    if (i < 0) return null;
    return { i, text: this.route.steps[i].text, distM: this.stepAt[i] - this.progressM };
  }
}

// How far along the route each turn instruction sits.
function indexSteps(route: PlannedRoute, cum: number[]): number[] {
  let i = 0;
  return route.steps.map((s) => {
    let best = i;
    let bestD = Infinity;
    for (let j = i; j < route.coords.length; j++) {
      const d = haversine(route.coords[j], s.location);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
      if (d < 1) break;
    }
    i = best;
    return cum[best];
  });
}
