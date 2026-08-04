DROP PROCEDURE IF EXISTS SearchVisibleCelestialObjects;

DELIMITER //

CREATE PROCEDURE SearchVisibleCelestialObjects(
    IN p_Keyword VARCHAR(250),
    IN p_CategoryCodes TEXT,
    IN p_Latitude DOUBLE,
    IN p_Longitude DOUBLE,
    IN p_LocalSiderealTime DOUBLE,
    IN p_MinAltitude DOUBLE,
    IN p_Limit INT,
    IN p_Offset INT
)
BEGIN

    -- Building LIKE Pattern
    DECLARE v_Keyword VARCHAR(250);                 -- Ex: "And"
    DECLARE v_LikePattern VARCHAR(252);             -- Ex: "%And%"

    SET v_Keyword = TRIM(COALESCE(p_Keyword, ''));  -- "  And  " -> "And"
                                                    -- NULL     -> ""
    IF v_Keyword = '' THEN                          -- If empty,
        SET v_LikePattern = '%';                    -- '%'
    ELSE                                                    -- If not empty,
        SET v_LikePattern = CONCAT('%', v_Keyword, '%');    -- "%And%"
    END IF;


    SELECT
    c.ObjectID,
    c.Name,
    c.Magnitude,
    c.ObjectCategory,
    c.RightAscension,
    c.Declination,
    c.Constellation,

    ROUND(
        DEGREES(
            ASIN(
                SIN(RADIANS(c.Declination)) * SIN(RADIANS(p_Latitude))
                + COS(RADIANS(c.Declination)) * COS(RADIANS(p_Latitude))
                * COS(RADIANS(p_LocalSiderealTime - c.RightAscension * 15))
            )
        ),
        2
    ) AS Altitude,

    COUNT(*) OVER() AS total

    FROM CelestialObject c JOIN (

    -- Set 1: objects matching the keyword and category using the LIKE pattern
    SELECT c.ObjectID           -- Return only ObjectIDs for the INTERSECT
    FROM CelestialObject c
    WHERE (
        c.Name LIKE v_LikePattern
                OR c.Constellation LIKE v_LikePattern
        )
        AND (
            p_CategoryCodes IS NULL         -- No category filter was selected
            OR p_CategoryCodes = ''         -- Category filter is empty (possibly redundant)
            OR FIND_IN_SET(c.ObjectCategory, p_CategoryCodes)
                                        -- Check whether this object's category code
                                        -- appears in the selected category list.
                                        -- LIKE cannot be used here because it performs
                                        -- substring matching (e.g. "S" would match "SS").
        )

    INTERSECT

    -- Set 2: objects currently above the minimum altitude (translated from visibility.py) (How high is it)
    SELECT visible.ObjectID
    FROM (  SELECT c.ObjectID,                                          -- subquery
                DEGREES(
                    ASIN(
                        SIN(RADIANS(c.Declination)) * SIN(RADIANS(p_Latitude))
                        + COS(RADIANS(c.Declination)) * COS(RADIANS(p_Latitude))
                        * COS(RADIANS(p_LocalSiderealTime - c.RightAscension * 15))
                    )
                ) AS Altitude
            FROM CelestialObject c
            WHERE c.RightAscension IS NOT NULL AND c.Declination IS NOT NULL
        ) AS visible

    WHERE visible.Altitude > p_MinAltitude          -- is it higher than p_MinAltitude that is passed as arg

    INTERSECT

    -- Set 3: objects bright enough under the local light pollution
    SELECT c.ObjectID
    FROM CelestialObject c
    WHERE c.Magnitude IS NOT NULL
                        AND c.Magnitude <> 0
                        AND c.Magnitude <= COALESCE((SELECT l.LimitingMag
                                                    FROM LightPollutionObservation l
                                                    WHERE l.LimitingMag IS NOT NULL
                                                        AND l.Latitude BETWEEN p_Latitude - 0.1448
                                                                        AND p_Latitude + 0.1448
                                                        AND l.Longitude BETWEEN p_Longitude - 10 / 69.17 * COS(RADIANS(p_Latitude))
                                                                        AND p_Longitude + 10 / 69.17 * COS(RADIANS(p_Latitude))
                                                    ORDER BY ABS(p_Latitude - l.Latitude), ABS(p_Longitude - l.Longitude)
                                                    LIMIT 1),
                                                    6.0)        -- if the subquery returns NULL, use 6.0 as a fallback

    ) AS MatchingObjectIDs
        ON c.ObjectID = MatchingObjectIDs.ObjectID      -- join on c.objectId

    ORDER BY
    (c.Magnitude = 0),
    c.Magnitude,
    Altitude DESC,
    c.ObjectID

    LIMIT p_Limit       -- pagenation
    OFFSET p_Offset;

END //

DELIMITER ;
