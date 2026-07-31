DELIMITER //

DROP PROCEDURE IF EXISTS SearchVisibleCelestialObjects //

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
    DECLARE v_Keyword VARCHAR(250);

    IF p_Keyword IS NULL THEN
        SET v_Keyword = '';
    ELSE
        SET v_Keyword = TRIM(p_Keyword);
    END IF;

    IF p_MinAltitude IS NULL THEN
        SET p_MinAltitude = 20;
    END IF;

    IF p_Limit IS NULL OR p_Limit < 1 THEN
        SET p_Limit = 48;
    END IF;

    IF p_Offset IS NULL OR p_Offset < 0 THEN
        SET p_Offset = 0;
    END IF;

    WITH MatchingObjectIDs AS (

        /*
          Set 1: objects matching the keyword and category.
        */
        SELECT c.ObjectID
        FROM CelestialObject c
        WHERE (
            v_Keyword = ''
            OR c.Name LIKE CONCAT('%', v_Keyword, '%')
            OR c.Constellation LIKE CONCAT('%', v_Keyword, '%')
        )
        AND (
            p_CategoryCodes IS NULL
            OR p_CategoryCodes = ''
            OR FIND_IN_SET(c.ObjectCategory, p_CategoryCodes) > 0
        )

        INTERSECT

        /*
          Set 2: objects currently above the minimum altitude.
        */
        SELECT visible.ObjectID
        FROM (
            SELECT
                c.ObjectID,
                DEGREES(
                    ASIN(
                        SIN(RADIANS(c.Declination))
                        * SIN(RADIANS(p_Latitude))
                        +
                        COS(RADIANS(c.Declination))
                        * COS(RADIANS(p_Latitude))
                        * COS(
                            RADIANS(
                                p_LocalSiderealTime
                                - c.RightAscension * 15
                            )
                        )
                    )
                ) AS Altitude
            FROM CelestialObject c
            WHERE c.RightAscension IS NOT NULL
              AND c.Declination IS NOT NULL
        ) AS visible
        WHERE visible.Altitude > p_MinAltitude

        INTERSECT

        /*
          Set 3: objects bright enough under local light pollution.
        */
        SELECT c.ObjectID
        FROM CelestialObject c
        WHERE c.Magnitude IS NOT NULL
          AND c.Magnitude <= COALESCE(
              (
                  SELECT l.LimitingMag
                  FROM LightPollutionObservation l
                  WHERE l.LimitingMag IS NOT NULL
                    AND l.Latitude BETWEEN
                        p_Latitude - 0.1448
                        AND p_Latitude + 0.1448
                    AND l.Longitude BETWEEN
                        p_Longitude
                            - 10 / 69.17
                            * COS(RADIANS(p_Latitude))
                        AND
                        p_Longitude
                            + 10 / 69.17
                            * COS(RADIANS(p_Latitude))
                  ORDER BY
                      ABS(p_Latitude - l.Latitude),
                      ABS(p_Longitude - l.Longitude)
                  LIMIT 1
              ),
              6.0
          )
    )

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
                    SIN(RADIANS(c.Declination))
                    * SIN(RADIANS(p_Latitude))
                    +
                    COS(RADIANS(c.Declination))
                    * COS(RADIANS(p_Latitude))
                    * COS(
                        RADIANS(
                            p_LocalSiderealTime
                            - c.RightAscension * 15
                        )
                    )
                )
            ),
            2
        ) AS Altitude,

        COUNT(*) OVER() AS total

    FROM CelestialObject c
    JOIN MatchingObjectIDs m
        ON c.ObjectID = m.ObjectID

    ORDER BY
        (c.Magnitude = 0),
        c.Magnitude,
        Altitude DESC,
        c.ObjectID

    LIMIT p_Limit
    OFFSET p_Offset;

END //

DELIMITER ;
