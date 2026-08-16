import { describe, expect, it } from "vitest";
import { buildOptimalOrder, simulate, TIGHT_THRESHOLD_MINUTES } from "./routing";
import type { DistanceMatrix, Stop } from "./types";

function makeStop(overrides: Partial<Stop> & { id: string }): Stop {
  return {
    address: "123 Test St",
    lat: 0,
    lng: 0,
    label: undefined,
    earliestTime: 9 * 60,
    latestTime: 17 * 60,
    durationMinutes: 10,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build a distance matrix from 1-D positions (in minutes of drive time).
 * positions[0] is the start location; positions[i] for i>=1 corresponds to stops[i-1].
 */
function matrixFromPositions(positions: number[]): DistanceMatrix {
  return positions.map((a) =>
    positions.map((b) => ({
      durationMinutes: Math.abs(a - b),
      distanceMiles: Math.abs(a - b) / 2,
    }))
  );
}

describe("simulate", () => {
  it("computes arrival, departure, slack and window status for a simple order", () => {
    const stops = [
      makeStop({ id: "a", earliestTime: 9 * 60, latestTime: 10 * 60, durationMinutes: 15 }),
      makeStop({ id: "b", earliestTime: 9 * 60, latestTime: 12 * 60, durationMinutes: 10 }),
    ];
    // start -> a is 20 min, a -> b is 30 min
    const matrix = matrixFromPositions([0, 20, 50]);
    const result = simulate([0, 1], stops, matrix, 9 * 60);

    expect(result.stops[0]!.arrivalTime).toBe(9 * 60 + 20);
    expect(result.stops[0]!.departureTime).toBe(9 * 60 + 20 + 15);
    expect(result.stops[0]!.windowStatus).toBe("on_time");

    const arrivalB = result.stops[0]!.departureTime + 30;
    expect(result.stops[1]!.arrivalTime).toBe(arrivalB);
    expect(result.missedCount).toBe(0);
  });

  it("waits for a window that opens later than a drive-time-only arrival", () => {
    const stops = [makeStop({ id: "a", earliestTime: 11 * 60, latestTime: 12 * 60 })];
    const matrix = matrixFromPositions([0, 10]); // 10 min drive
    const result = simulate([0], stops, matrix, 9 * 60); // would arrive 9:10 without waiting

    expect(result.stops[0]!.arrivalTime).toBe(11 * 60);
    expect(result.stops[0]!.windowStatus).toBe("on_time");
  });

  it("flags a stop as missed when arrival is after latest_time", () => {
    const stops = [makeStop({ id: "a", earliestTime: 9 * 60, latestTime: 9 * 60 + 5 })];
    const matrix = matrixFromPositions([0, 30]); // 30 min drive, window closes at +5
    const result = simulate([0], stops, matrix, 9 * 60);

    expect(result.stops[0]!.windowStatus).toBe("missed");
    expect(result.missedCount).toBe(1);
    expect(result.stops[0]!.slackMinutes).toBeLessThan(0);
  });

  it("flags a stop as tight when slack is within the tight threshold", () => {
    const stops = [
      makeStop({ id: "a", earliestTime: 9 * 60, latestTime: 9 * 60 + 30 + TIGHT_THRESHOLD_MINUTES }),
    ];
    const matrix = matrixFromPositions([0, 30]);
    const result = simulate([0], stops, matrix, 9 * 60);

    expect(result.stops[0]!.windowStatus).toBe("tight");
    expect(result.missedCount).toBe(0);
  });
});

describe("buildOptimalOrder", () => {
  it("orders stops to minimize drive time when all windows are wide open", () => {
    // start at 0, stop A at position 10, stop B at position 20 (in minutes of drive)
    // Visiting A then B (0->10->20) costs 20 min total; B then A (0->20->10) costs 30 min.
    const stops = [
      makeStop({ id: "a", earliestTime: 0, latestTime: 24 * 60 }),
      makeStop({ id: "b", earliestTime: 0, latestTime: 24 * 60 }),
    ];
    const matrix = matrixFromPositions([0, 10, 20]);
    const { order, simulation } = buildOptimalOrder(stops, matrix, 9 * 60);

    expect(order).toEqual([0, 1]);
    expect(simulation.missedCount).toBe(0);
    expect(simulation.totalDriveMinutes).toBe(20);
  });

  it("prioritizes satisfying time windows over minimizing drive distance", () => {
    // Positions: start=0, A=10, B=20 (minutes of drive from start).
    // Nearest-neighbor-by-distance would visit A (closer) then B.
    // But A's window closes very early — only visiting B first, then A, hits both windows.
    const stops = [
      makeStop({ id: "a", earliestTime: 0, latestTime: 24 * 60 }), // wide open, visit anytime
      makeStop({ id: "b", earliestTime: 0, latestTime: 9 * 60 + 25 }), // must arrive by 9:25
    ];
    const matrix = matrixFromPositions([0, 10, 20]);
    const { order, simulation } = buildOptimalOrder(stops, matrix, 9 * 60);

    // Visiting b (index 1) first satisfies both windows; visiting a first would make b late.
    expect(order[0]).toBe(1);
    expect(simulation.missedCount).toBe(0);
  });

  it("minimizes missed windows even when it increases total drive time", () => {
    // Three stops in a line: A(10), B(20), C(30). Only one of A/C can be hit
    // if B's window is very narrow and forces a detour — algorithm should still
    // hit as many as possible rather than optimizing purely for distance.
    const stops = [
      makeStop({ id: "a", earliestTime: 0, latestTime: 24 * 60 }),
      makeStop({ id: "b", earliestTime: 9 * 60 + 15, latestTime: 9 * 60 + 25 }),
      makeStop({ id: "c", earliestTime: 0, latestTime: 24 * 60 }),
    ];
    const matrix = matrixFromPositions([0, 10, 20, 30]);
    const { simulation } = buildOptimalOrder(stops, matrix, 9 * 60);

    expect(simulation.missedCount).toBe(0);
  });

  it("flags a stop that cannot be made under any order", () => {
    const stops = [
      makeStop({ id: "a", earliestTime: 0, latestTime: 24 * 60 }),
      makeStop({ id: "impossible", earliestTime: 9 * 60, latestTime: 9 * 60 + 2 }), // 60 min away, window closes in 2 min
    ];
    const matrix = matrixFromPositions([0, 5, 60]);
    const { simulation } = buildOptimalOrder(stops, matrix, 9 * 60);

    expect(simulation.missedCount).toBe(1);
    const impossible = simulation.stops.find((s) => stops[s.index]!.id === "impossible");
    expect(impossible?.windowStatus).toBe("missed");
  });

  it("handles an empty stop list", () => {
    const matrix = matrixFromPositions([0]);
    const { order, simulation } = buildOptimalOrder([], matrix, 9 * 60);
    expect(order).toEqual([]);
    expect(simulation.totalDriveMinutes).toBe(0);
  });
});
