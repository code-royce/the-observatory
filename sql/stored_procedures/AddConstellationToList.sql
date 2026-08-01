/*
AddConstellationToList.sql

Purpose:
  Saves a whole constellation's bright stars to an ObservationList in one
  call, and reports what the user just got: how many stars the constellation
  has, how many of them beat the light pollution where the list is, how many
  were newly added, and how many were already saved.

  There is no Constellation table. CelestialObject.Constellation names the
  region of sky a star sits in, so "belongs to this constellation" is
  approximated as the brightest 'connect the dots' stars in that region
  (Magnitude < parMaxMagnitude).

  Adding the members as ordinary SavedObject rows means everything that
  already reads a list keeps working without knowing a constellation was
  involved.

Parameters:
  parListID         -- ObservationList.ListID to add to
  parConstellation  -- constellation name, e.g. 'Orion'
  parObservedStatus -- 'seen' or 'not seen'
  parMaxMagnitude   -- faintest star to treat as a member. Pass 3 to match the
                       design doc's published figures. MySQL has no default
                       parameter values, so every caller must supply it.
*/

DROP PROCEDURE IF EXISTS AddConstellationToList;

DELIMITER //

CREATE PROCEDURE AddConstellationToList(
    IN parListID INT,
    IN parConstellation VARCHAR(250),
    IN parObservedStatus VARCHAR(250),
    IN parMaxMagnitude FLOAT
)
BEGIN
    DECLARE varLatitude DOUBLE;
    DECLARE varLongitude DOUBLE;
    DECLARE varStarCount INT;
    DECLARE varVisibleCount INT;
    DECLARE varAdded INT;

    -- Visibility is judged from where the list is, not where the user is.
    -- A list with no coordinates leaves these NULL; whether the list exists
    -- at all is left to SavedObject's foreign key on the INSERT below.
    SELECT Latitude, Longitude
    INTO varLatitude, varLongitude
    FROM ObservationList
    WHERE ListID = parListID;

    -- Counts this constellation's bright stars, and how many of them beat
    -- the light pollution where the list is.
    SELECT COUNT(c.ObjectID),
           SUM(c.Magnitude <= VisibleHere.LimitingMag)
    INTO varStarCount, varVisibleCount
    FROM CelestialObject c
        CROSS JOIN (
            -- Single-row derived table producing the local limiting magnitude,
            -- averaged over the three nearest observations within 10 miles.
            -- Falls back to the suburban/rural average of 6 when none are on file.
            SELECT COALESCE(AVG(LimitingMag), 6) AS LimitingMag
            FROM (
                SELECT LimitingMag
                FROM LightPollutionObservation
                -- 10 land miles = (approx) 0.1448 degrees latitude shift
                WHERE Latitude BETWEEN varLatitude - 0.1448
                                   AND varLatitude + 0.1448
                    -- longitude shift scaled by latitude for Earth's curvature
                    AND Longitude BETWEEN
                        varLongitude - 10 / 69.17 * COS(RADIANS(varLatitude))
                        AND varLongitude + 10 / 69.17 * COS(RADIANS(varLatitude))
                ORDER BY ABS(varLatitude - Latitude),
                         ABS(varLongitude - Longitude)
                LIMIT 3
            ) AS ThreeClosest
        ) AS VisibleHere
    WHERE c.Constellation = parConstellation
        AND c.Magnitude < parMaxMagnitude;

    -- No constraint knows what a real constellation code is, so this one
    -- has to be raised rather than caught.
    -- Stops before an INSERT that would match nothing.
    IF varStarCount = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No constellation matches that code';
    END IF;

    -- Stars already on the list are filtered out rather than left to
    -- collide: (ListID, ObjectID) is SavedObject's primary key, and a
    -- single duplicate would abort the INSERT, adding none of the rest.
    INSERT INTO SavedObject (ListID, ObjectID, ObservedStatus)
    SELECT parListID, c.ObjectID, parObservedStatus
    FROM CelestialObject c
    WHERE c.Constellation = parConstellation
        AND c.Magnitude < parMaxMagnitude
        AND NOT EXISTS (
            SELECT 1 FROM SavedObject s
            WHERE s.ListID = parListID
                AND s.ObjectID = c.ObjectID
        );

    SET varAdded = ROW_COUNT();

    SELECT varStarCount            AS StarCount,
           varVisibleCount         AS VisibleCount,
           varAdded                AS Added,
           varStarCount - varAdded AS AlreadyOnList;
END //

DELIMITER ;
