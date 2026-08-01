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
