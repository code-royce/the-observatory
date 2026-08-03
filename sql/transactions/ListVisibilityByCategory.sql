/*
ListVisibilityByCategory.sql

Purpose:
  For one ObservationList saved at a known location, reports three counts per
  object category: how many objects are on the list, how many of those are
  bright enough to see through the local light pollution at all, and how many
  of those are also above the horizon right now. Pairs with
  ListMetadataByCategory.sql to answer "of what I still want to see, what can
  I actually see tonight from here?"

Parameters:
  list_id  -- ObservationList.ListID to report on
  lat      -- the list's Latitude, degrees
  lon      -- the list's Longitude, degrees east-positive
  lst      -- local sidereal time, degrees (computed in Python)
  min_alt  -- minimum altitude to count as visible, degrees
*/

WITH LocalLimit AS (
    -- Faintest magnitude visible here, averaged over the three nearest
    -- light pollution observations within roughly 10 miles.
    -- Default to 6 (suburban/rural conditions).
    SELECT COALESCE(AVG(LimitingMag), 6) AS LimitingMag
    FROM (
        SELECT LimitingMag
        FROM LightPollutionObservation
        -- 10 land miles = (approx) 0.1448 degrees latitude shift
        WHERE Latitude BETWEEN %(lat)s - 0.1448 AND %(lat)s + 0.1448
            -- longitude shift scaled by latitude for Earth's curvature
            AND Longitude BETWEEN
                %(lon)s - 10 / 69.17 * COS(RADIANS(%(lat)s))
                AND %(lon)s + 10 / 69.17 * COS(RADIANS(%(lat)s))
        ORDER BY ABS(%(lat)s - Latitude), ABS(%(lon)s - Longitude)
        LIMIT 3
    ) AS ThreeClosest
)
SELECT c.ObjectCategory,
       COUNT(*) AS OnList,
       SUM(c.Magnitude <= l.LimitingMag) AS Observable,
       SUM(
           c.Magnitude <= l.LimitingMag
           -- SQL translation of python trig in app/horizon_calculator.altitude()
           -- Finds celestialObjects with current altitudes above the horizon + min_alt
           AND DEGREES(ASIN(
               SIN(RADIANS(c.Declination)) * SIN(RADIANS(%(lat)s))
               + COS(RADIANS(c.Declination)) * COS(RADIANS(%(lat)s))
                   * COS(RADIANS(%(lst)s - c.RightAscension * 15))
           )) > %(min_alt)s    -- min_alt accounts for trees, buildings, refraction, etc.
       ) AS UpNow
FROM SavedObject s
    JOIN CelestialObject c ON c.ObjectID = s.ObjectID
    -- Single-row CTE, so this attaches the local limiting magnitude to every
    -- row without changing the row count.
    CROSS JOIN LocalLimit l
WHERE s.ListID = %(list_id)s
GROUP BY c.ObjectCategory
ORDER BY UpNow DESC, OnList DESC;
