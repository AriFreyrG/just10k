// Smoke test: drive the real screen from setup to a finished (simulated)
// walk, with the map, GPS, sensors and network mocked out.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import Home from "../app/index";
import { pathLength, type LatLon } from "../lib/loop";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-keep-awake", () => ({ useKeepAwake: () => {} }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Warning: "warning" },
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: { cache: "/cache" } }));
jest.mock("expo-sensors", () => ({ Pedometer: { isAvailableAsync: async () => false } }));
jest.mock("expo-location", () => ({
  Accuracy: { High: 4, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: async () => ({ granted: true }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 51.5072, longitude: -0.1276 } }),
  watchPositionAsync: async () => ({ remove: () => {} }),
}));
jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = React.forwardRef((props: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ fitToCoordinates: jest.fn(), animateToRegion: jest.fn() }));
    return <View testID="map">{props.children}</View>;
  });
  const Polyline = (p: object) => <View testID="polyline" {...p} />;
  const Marker = (p: object) => <View testID="marker" {...p} />;
  return { __esModule: true, default: MapView, Polyline, Marker };
});

// Fake OSRM: straight lines between the requested points, 1.3x "street" factor.
beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    const pts = url.split("/foot/")[1].split("?")[0].split(";").map((s) => s.split(",").map(Number));
    const coords: [number, number][] = [];
    for (let i = 1; i < pts.length; i++)
      for (let k = 0; k <= 30; k++)
        coords.push([pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 30, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 30]);
    const distance = pathLength(coords.map(([lon, lat]) => [lat, lon] as LatLon)) * 1.3;
    const legs = pts.slice(1).map((p, i) => ({
      steps: [
        { name: "Start St", distance: 0, maneuver: { type: "depart", location: pts[i] } },
        { name: "Park Rd", distance: 0, maneuver: { type: "turn", modifier: "left", location: pts[i] } },
        { name: "", distance: 0, maneuver: { type: "arrive", location: p } },
      ],
    }));
    return { ok: true, json: async () => ({ code: "Ok", routes: [{ distance, geometry: { coordinates: coords }, legs }] }) };
  }) as unknown as typeof fetch;
});

test("plan a loop, pick one, simulate the walk to the end", async () => {
  await render(<Home />);
  await screen.findByText("Where you are now");
  expect(screen.getByText("steps to go")).toBeTruthy();
  expect(screen.getByText("10,000")).toBeTruthy();
  expect(screen.getByText("≈ 7.0 km")).toBeTruthy();

  await fireEvent.press(screen.getByText("Find me a loop"));
  await screen.findByText("Loop 1 of 3");
  // The picked loop is drawn twice (casing + line), the other two as ghosts.
  expect(screen.getAllByTestId("polyline")).toHaveLength(4);
  expect(screen.getAllByText("Start St & Park Rd")).toHaveLength(3);

  // Each option should land within 5% of the target.
  const options = screen.getAllByTestId("loop-steps");
  expect(options).toHaveLength(3);
  for (const opt of options) {
    const steps = Number(String(opt.props.children).replace(/,/g, ""));
    expect(Math.abs(steps - 10000) / 10000).toBeLessThan(0.05);
  }

  jest.useFakeTimers();
  await fireEvent.press(screen.getByText("Simulate walk"));
  expect(screen.getByText("End walk")).toBeTruthy();
  expect(screen.getByText(/of 10,000 steps/)).toBeTruthy();
  for (let i = 0; i < 600 && !screen.queryByText("Back to start"); i++) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
  }
  jest.useRealTimers();
  await waitFor(() => expect(screen.getByText("Back to start")).toBeTruthy());
  expect(screen.getByText("this walk")).toBeTruthy();
  expect(screen.getByText(/steps today\./)).toBeTruthy();

  await fireEvent.press(screen.getByText("Back to start"));
  expect(screen.getByText("Find me a loop")).toBeTruthy();
});
