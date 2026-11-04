import type { PlannedRoute } from "../lib/loop";
import { appleMapsUrl } from "../lib/share";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: {} }));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));

test("Apple Maps link is a walking loop through the waypoints", () => {
  const route = { waypoints: [[64.1, -21.9], [64.2, -21.8]] } as unknown as PlannedRoute;
  expect(appleMapsUrl([64, -22], route)).toBe(
    "https://maps.apple.com/directions?source=64.000000,-22.000000&destination=64.000000,-22.000000" +
      "&waypoint=64.100000,-21.900000&waypoint=64.200000,-21.800000&mode=walking",
  );
});
