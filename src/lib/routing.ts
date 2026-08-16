import type { DistanceMatrix, Stop, WindowStatus } from "./types";

/**
 * Time-window-aware stop ordering.
 *
 * This is deliberately NOT a shortest-distance TSP solver. The cost function
 * below ranks a candidate order by (1) how many pickup windows it misses,
 * then (2) total minutes late across missed windows, then (3) total drive
 * time — in that priority order — so the search always prefers hitting more
 * windows over a shorter drive.
 */

export const TIGHT_THRESHOLD_MINUTES = 10;

const MISSED_PENALTY = 1_000_000;
const LATE_MINUTE_PENALTY = 1_000;

export interface SimulatedStop {
  /** index into the stops array passed to simulate() */
  index: number;
  arrivalTime: number;
  departureTime: number;
  driveMinutesFromPrev: number;
  driveMilesFromPrev: number;
  slackMinutes: number;
  windowStatus: WindowStatus;
}

export interface SimulationResult {
  stops: SimulatedStop[];
  totalDriveMinutes: number;
  totalDriveMiles: number;
  missedCount: number;
  totalLateMinutes: number;
  cost: number;
}

/** Walk a candidate visiting order and compute arrival/departure/flags for each stop. */
export function simulate(
  order: number[],
  stops: Stop[],
  matrix: DistanceMatrix,
  startTime: number
): SimulationResult {
  let currentTime = startTime;
  let prevMatrixIndex = 0; // 0 = start location
  let totalDriveMinutes = 0;
  let totalDriveMiles = 0;
  let missedCount = 0;
  let totalLateMinutes = 0;
  const simStops: SimulatedStop[] = [];

  for (const stopIdx of order) {
    const matrixIdx = stopIdx + 1;
    const cell = matrix[prevMatrixIndex]?.[matrixIdx];
    if (!cell) {
      throw new Error(`Missing distance matrix cell [${prevMatrixIndex}][${matrixIdx}]`);
    }
    const stop = stops[stopIdx];
    if (!stop) {
      throw new Error(`Missing stop at index ${stopIdx}`);
    }
    const drive = cell.durationMinutes;
    let arrival = currentTime + drive;
    if (arrival < stop.earliestTime) {
      arrival = stop.earliestTime; // arrived early, wait for the window to open
    }
    const slack = stop.latestTime - arrival;

    let windowStatus: WindowStatus;
    if (slack < 0) {
      windowStatus = "missed";
      missedCount += 1;
      totalLateMinutes += -slack;
    } else if (slack <= TIGHT_THRESHOLD_MINUTES) {
      windowStatus = "tight";
    } else {
      windowStatus = "on_time";
    }

    const departure = arrival + stop.durationMinutes;

    simStops.push({
      index: stopIdx,
      arrivalTime: arrival,
      departureTime: departure,
      driveMinutesFromPrev: drive,
      driveMilesFromPrev: cell.distanceMiles,
      slackMinutes: slack,
      windowStatus,
    });

    totalDriveMinutes += drive;
    totalDriveMiles += cell.distanceMiles;
    currentTime = departure;
    prevMatrixIndex = matrixIdx;
  }

  const cost =
    missedCount * MISSED_PENALTY + totalLateMinutes * LATE_MINUTE_PENALTY + totalDriveMinutes;

  return { stops: simStops, totalDriveMinutes, totalDriveMiles, missedCount, totalLateMinutes, cost };
}

/** Greedy nearest-neighbor by raw drive time, ignoring time windows. */
function nearestNeighborByDrive(stops: Stop[], matrix: DistanceMatrix): number[] {
  const unvisited = new Set(stops.map((_, i) => i));
  const order: number[] = [];
  let prevMatrixIndex = 0;

  while (unvisited.size > 0) {
    let best: number | null = null;
    let bestDrive = Infinity;
    for (const idx of unvisited) {
      const drive = matrix[prevMatrixIndex]?.[idx + 1]?.durationMinutes ?? Infinity;
      if (drive < bestDrive) {
        bestDrive = drive;
        best = idx;
      }
    }
    order.push(best as number);
    unvisited.delete(best as number);
    prevMatrixIndex = (best as number) + 1;
  }

  return order;
}

/** Sort purely by deadline (earliest latest_time first). */
function earliestDeadlineFirst(stops: Stop[]): number[] {
  return stops
    .map((_, i) => i)
    .sort((a, b) => stops[a]!.latestTime - stops[b]!.latestTime);
}

/** Local search: repeatedly try 2-opt segment reversals and single-stop relocations, keeping any move that lowers cost. */
function localSearchImprove(
  initialOrder: number[],
  stops: Stop[],
  matrix: DistanceMatrix,
  startTime: number
): number[] {
  let order = [...initialOrder];
  let bestCost = simulate(order, stops, matrix, startTime).cost;
  const n = order.length;
  const maxPasses = 25;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    // 2-opt: reverse each contiguous segment
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ];
        const cost = simulate(candidate, stops, matrix, startTime).cost;
        if (cost < bestCost) {
          order = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }

    // or-opt: relocate a single stop to every other position
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= n; j++) {
        if (j === i || j === i + 1) continue;
        const candidate = [...order];
        const [moved] = candidate.splice(i, 1);
        const insertPos = j > i ? j - 1 : j;
        candidate.splice(insertPos, 0, moved as number);
        const cost = simulate(candidate, stops, matrix, startTime).cost;
        if (cost < bestCost) {
          order = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return order;
}

export interface RouteOrderResult {
  order: number[]; // indices into the stops array
  simulation: SimulationResult;
}

/**
 * Build the best visiting order for a set of stops given a precomputed
 * distance matrix (index 0 = start location, 1..n = stops[0..n-1]).
 *
 * Strategy: build two candidate seed tours (nearest-neighbor-by-drive-time,
 * and earliest-deadline-first), take whichever scores better, then run a
 * 2-opt + or-opt local search on top of it. All of this runs against the
 * already-fetched distance matrix, so rebuilding after adding a stop is
 * fast and makes no additional API calls beyond geocoding/matrix refresh
 * for the new stop.
 */
export function buildOptimalOrder(
  stops: Stop[],
  matrix: DistanceMatrix,
  startTime: number
): RouteOrderResult {
  if (stops.length === 0) {
    return { order: [], simulation: simulate([], stops, matrix, startTime) };
  }

  const nnOrder = nearestNeighborByDrive(stops, matrix);
  const edfOrder = earliestDeadlineFirst(stops);
  const nnSim = simulate(nnOrder, stops, matrix, startTime);
  const edfSim = simulate(edfOrder, stops, matrix, startTime);

  const seed = nnSim.cost <= edfSim.cost ? nnOrder : edfOrder;
  const improvedOrder = localSearchImprove(seed, stops, matrix, startTime);
  const simulation = simulate(improvedOrder, stops, matrix, startTime);

  return { order: improvedOrder, simulation };
}

export function windowStatusToStopStatus(status: WindowStatus): "confirmed_in_route" | "at_risk" | "missed" {
  if (status === "on_time") return "confirmed_in_route";
  if (status === "tight") return "at_risk";
  return "missed";
}
