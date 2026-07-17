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

export type Constellation = string;

export interface CelestialObject {
  id: string;
  name?: string;
  magnitude: number;
  type: ObjectType;
  ra: number;
  dec: number;
  constellation: string;
}

export const CELESTIAL_OBJECTS: CelestialObject[] = [
  {
    id: "m31",
    name: "Andromeda Galaxy",
    type: "Galaxy",
    constellation: "Andromeda",
    magnitude: 3.44,
    ra: 10.68,
    dec: 41.266667,
  },
  {
    id: "m42",
    name: "Orion Nebula",
    type: "Planetary Nebula",
    constellation: "Orion",
    magnitude: 4.0,
    ra: 83.82,
    dec: -5.383333,
  },
  {
    id: "m45",
    name: "Pleiades",
    type: "Open Cluster",
    constellation: "Taurus",
    magnitude: 1.6,
    ra: 56.85,
    dec: 24.116667,
  },
  {
    id: "m13",
    name: "Hercules Cluster",
    type: "Globular Cluster",
    constellation: "Hercules",
    magnitude: 5.8,
    ra: 250.42,
    dec: 36.45,
  },
  {
    id: "m57",
    name: "Ring Nebula",
    type: "Reflection Nebula",
    constellation: "Lyra",
    magnitude: 8.8,
    ra: 283.40,
    dec: 33.016667,
  },
  {
    id: "m51",
    name: "Whirlpool Galaxy",
    type: "Galaxy",
    constellation: "Canes Venatici",
    magnitude: 8.4,
    ra: 202.47,
    dec: 47.183333,
  },
  {
    id: "m1",
    name: "Crab Nebula",
    type: "Reflection Nebula",
    constellation: "Taurus",
    magnitude: 8.4,
    ra: 83.63,
    dec: 22,
  },
  {
    id: "sirius",
    name: "Sirius",
    type: "Star",
    constellation: "Canis Major",
    magnitude: -1.46,
    ra: 101.29,
    dec: 16.7,
  },
  {
    id: "vega",
    name: "Vega",
    type: "Star",
    constellation: "Lyra",
    magnitude: 0.03,
    ra: 279.23,
    dec: 38.47,
  },
  {
    id: "m81",
    name: "Bode's Galaxy",
    type: "Galaxy",
    constellation: "Ursa Major",
    magnitude: 6.94,
    ra: 148.89,
    dec: 69.03,
  },
  {
    id: "m104",
    name: "Sombrero Galaxy",
    type: "Galaxy",
    constellation: "Virgo",
    magnitude: 8.0,
    ra: 190.00,
    dec: -11.37,
  },
  {
    id: "m27",
    name: "Dumbbell Nebula",
    type: "Planetary Nebula",
    constellation: "Vulpecula",
    magnitude: 7.5,
    ra: 299.90,
    dec: 22.43,
  },
  {
    id: "albireo",
    name: "Albireo",
    type: "Double Star",
    constellation: "Cygnus",
    magnitude: 3.18,
    ra: 292.68,
    dec: 27.57,
  },
  {
    id: "m8",
    name: "Lagoon Nebula",
    type: "Reflection Nebula",
    constellation: "Sagittarius",
    magnitude: 6.0,
    ra: 270.90,
    dec: -24.23,
  },
  {
    id: "m44",
    name: "Beehive Cluster",
    type: "Globular Cluster",
    constellation: "Cancer",
    magnitude: 3.7,
    ra: 130.10,
    dec: 19.59,
  },
  {
    id: "m64",
    name: "Black Eye Galaxy",
    type: "Galaxy",
    constellation: "Coma Berenices",
    magnitude: 8.52,
    ra: 194.18,
    dec: 21.41,
  },
];

export interface CommunityNote {
  id: string;
  author: string;
  latitude: string;
  longitude: string;
  date: string;
  notes: string;
}

export const COMMUNITY_NOTES: CommunityNote[] = [
  {
    id: "n1",
    author: "Clara Voss",
    latitude: "Cherry Springs, PA",
    longitude: "Cherry Springs, PA",
    date: "2026-06-08",
    notes: "Outstanding night at Cherry Springs. Milky Way was incredibly detailed — could resolve individual star clouds in Sagittarius with the naked eye. M13 was breathtaking in the 10\" dob. Light dome from Coudersport barely visible.",
  },
  {
    id: "n2",
    author: "David Nakamura",
    latitude: "Mount Lemmon, AZ",
    longitude: "",
    date: "2026-06-06",
    notes: "Monsoon season approaching but still had a great session. Seeing was exceptional — planetary detail on Saturn was the best I've seen this year. Ring shadow clearly visible. Transparency dropped near midnight with some high cirrus.",
  },
  {
    id: "n3",
    author: "Mei-Lin Zhao",
    latitude: "Death Valley, CA",
    longitude: "",
    date: "2026-06-04",
    notes: "Bortle 1 skies as promised. Airglow was stunning — visible as a faint greenish glow on the horizon. Zodiacal light was prominent. Brought my 4\" refractor and had fantastic wide-field views of Scorpius region. M6 and M7 were spectacular.",
  },
  {
    id: "n4",
    author: "Tom Eriksen",
    latitude: "Exmoor Dark Sky Reserve, UK",
    longitude: "",
    date: "2026-06-03",
    notes: "Managed two hours before clouds rolled in. Seeing was poor due to jet stream — stars were twinkling significantly. Good for deep sky but planetary detail was poor. Caught the Virgo Galaxy Cluster before clouds covered the south.",
  },
  {
    id: "n5",
    author: "Anika Patel",
    latitude: "Big Bend National Park, TX",
    longitude: "",
    date: "2026-05-31",
    notes: "New moon weekend and Big Bend delivered. No wind all night, temps stayed comfortable. Spent the session on galaxies in Virgo. M87 jet was just detectable in the 12\" at high power. Sqm reading: 21.8 mag/arcsec².",
  },
];
