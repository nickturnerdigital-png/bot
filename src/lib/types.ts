export type StopStatus =
  | "pending" // added, not yet part of a built route
  | "confirmed_in_route" // in the last built route, comfortably on time
  | "at_risk" // in the last built route, tight on time (small buffer before latest_time)
  | "missed" // in the last built route, arrival is projected after latest_time
  | "done"; // marked complete by the user

export interface Stop {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  label?: string;
  /** minutes since midnight, local time */
  earliestTime: number;
  /** minutes since midnight, local time */
  latestTime: number;
  durationMinutes: number;
  status: StopStatus;
  createdAt: string;
}

export type NewStopInput = Omit<Stop, "id" | "lat" | "lng" | "status" | "createdAt"> & {
  lat?: number | null;
  lng?: number | null;
};

export type WindowStatus = "on_time" | "tight" | "missed";

export interface RouteStopResult {
  stopId: string;
  order: number;
  /** minutes since midnight */
  arrivalTime: number;
  /** minutes since midnight */
  departureTime: number;
  driveMinutesFromPrev: number;
  driveMilesFromPrev: number;
  /** minutes of buffer before latest_time; negative means late */
  slackMinutes: number;
  windowStatus: WindowStatus;
}

export interface RouteResult {
  id: string;
  date: string;
  startAddress: string;
  startLat: number | null;
  startLng: number | null;
  /** minutes since midnight the route departs */
  startTime: number;
  orderedStopIds: string[];
  stopResults: RouteStopResult[];
  unresolvedStopIds: string[]; // stops that could not be geocoded / included
  totalDriveMinutes: number;
  totalDriveMiles: number;
  missedCount: number;
  atRiskCount: number;
  builtAt: string;
  mapsUrls: string[]; // one or more legs, chunked to respect Google Maps waypoint limits
  appleMapsUrl: string; // best-effort, first-to-last leg only (see lib/mapsUrl.ts)
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceMatrixCell {
  durationMinutes: number;
  distanceMiles: number;
}

/** matrix[i][j] = travel from point i to point j. Index 0 is always the start location. */
export type DistanceMatrix = DistanceMatrixCell[][];
