// Corresponds with groupings of ObjectCategory columns in the database.
// The "pd" (plate defect) is intentionally omitted.
export const ALL_TYPES = [
  "Star", "Double Star", "Triple Star", "Galaxy", "Unidentified",
  "Reflection Nebula", "Open Cluster", "Globular Cluster", "Planetary Nebula",
  "Asterism", "Knot"] as const;

export type ObjectType = typeof ALL_TYPES[number];

// Tailwind color classes corresponding with each ObjectType.
export const TYPE_COLORS: Record<ObjectType, string> = {
  Star: "text-yellow-300 bg-yellow-300/10",
  "Double Star": "text-rose-400 bg-rose-400/10",
  "Triple Star": "text-cyan-400 bg-cyan-400/10",
  Galaxy: "text-blue-400 bg-blue-400/10",
  Unidentified: "text-gray-400 bg-gray-400/10",
  "Reflection Nebula": "text-purple-400 bg-purple-400/10",
  "Open Cluster": "text-green-400 bg-green-400/10",
  "Globular Cluster": "text-orange-400 bg-orange-400/10",
  "Planetary Nebula": "text-teal-400 bg-teal-400/10",
  Asterism: "text-amber-300 bg-amber-300/10",
  Knot: "text-fuchsia-400 bg-fuchsia-400/10"
};

// An instance of CelestialObject represents 1 row in the CelestialObject table.
export interface CelestialObject {
  ObjectID: number;
  Name?: string;
  Magnitude: number;
  ObjectCategory: ObjectType;
  RightAscension: number;
  Declination: number;
  Constellation: string;
  Altitude?: number;
}

// An instance of CommunityReport represents 1 row in the CommunityReport table
// NATURAL JOINed with the UserID and UserName columns of the Users table.
export interface CommunityReport {
  ReportID: number;
  UserID: number;
  UserName: string;
  Latitude: number;
  Longitude: number;
  CreatedAt: string;
  ReportText: string;
}

// One row of GET /api/reports/nearby -- a CommunityReport near the observer,
// plus the light pollution measured around that report. Shaped by the query
// rather than by CommunityReport above: no UserID, and the author is LEFT
// JOINed so a report written without one still appears.
export interface NearbyReport {
  ReportID: number;
  UserName: string | null;
  Latitude: number;
  Longitude: number;
  CreatedAt: string;
  ReportText: string;
  // Whole days since the report was written.
  DaysAgo: number;
  // Straight-line distance from the location that was checked.
  MilesAway: number;
  // Faintest magnitude visible around the report. Falls back to 6 when
  // NearbyObservations is 0, so the two must be read together.
  AvgLimitingMag: number;
  // Light pollution readings the average covers, within 10 miles.
  NearbyObservations: number;
}

// An instance of User represents 1 row in the Users table.
export type User = {
  id: number;
  name?: string;
  email: string;
};

// One row of the constellation visibility ranking. There is no Constellation
// table -- these are aggregates over CelestialObject.Constellation.
export interface ConstellationVisibility {
  Constellation: string;
  // Stars beating the light pollution at the observer's location.
  VisibleCount: number;
  // Stars the constellation has at the counting cutoff.
  StarCount: number;
  // Formatted in SQL, e.g. "63%". Divide the counts for a number.
  VisibilityPercentage: string;
}

// One star plotted on a constellation map. Drawn to a looser magnitude than
// the counts above use, so a figure has enough stars to show its shape.
export interface ConstellationStar {
  Name: string | null;
  // Hours, 0-24 -- not degrees.
  RightAscension: number;
  // Degrees.
  Declination: number;
  Magnitude: number;
  // Bright enough to beat the light pollution at the observer's location.
  Visible: boolean;
  // One of the stars the counts and the add button act on.
  IsMember: boolean;
}

// One CelestialObject saved to a list, joined with ObservedStatus/AddedAt,
// as returned by GET /api/lists/<id>. Lives only in ListDetail's own
// paginated state -- never inside the shared `lists` array.
export interface SavedObject {
  objectID: number;
  name: string | null;
  magnitude: number;
  objectCategory: ObjectType;
  rightAscension: number;
  declination: number;
  constellation: string;
  observedStatus: string;
  addedAt: string;
}

// Represents 1 row in the ObservationList table, plus the ObjectCount from
// the lightweight index route. Never carries per-object items -- that's
// SavedObject above, fetched separately and paginated by ListDetail.
export interface ObservationList {
  listID: number;
  userID: number;
  name: string;
  lat: string; // "" when the list has no saved location
  lon: string; // "" when the list has no saved location
  createdAt: string;
  objectCount: number;
}
