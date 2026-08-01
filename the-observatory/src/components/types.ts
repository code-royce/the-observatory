// ObjectCategory column in the database
export type ObjectType =
  | "Star"
  | "Double Star"
  | "Triple Star"
  | "Galaxy"
  | "Unidentified"
  | "Reflection Nebula"
  | "Open Cluster"
  | "Globular Cluster"
  | "Planetary Nebula"
  | "Asterism"
  | "Knot";

// An instance of CelestialObject represents 1 row in the CelestialObject table.
export interface CelestialObject {
  ObjectID: number;
  Name?: string;
  Magnitude: number;
  ObjectCategory: ObjectType;
  RightAscension: number;
  Declination: number;
  Constellation: string;
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
