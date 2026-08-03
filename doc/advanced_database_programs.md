# Advanced Database Programs

Each item is followed by the route that reaches it, so every program below can
be triggered from the running application.

The live copies live in `sql/`, next to the code that loads them.
This file is a duplicate for review — `app/routes/lists.py` reads `sql/transactions/*.sql` off disk at import, so those files cannot be moved.

---

## 1. Transaction

**Isolation level: `REPEATABLE READ`.**
Reached by `GET /api/lists/<list_id>` (`app/routes/lists.py`, `list_detail()`), which the frontend calls whenever a user opens one of their observation lists.

The route returns three things that describe one list: a per-category progress
summary, per-category visibility counts, and a total row count. They come from
separate statements and cannot be derived from one another.
`REPEATABLE READ` is what makes it honest to present them together.

### Transaction control (`app/routes/lists.py`)

```python
with get_db_connection() as conn:
    conn.start_transaction(isolation_level='REPEATABLE READ')

    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(LIST_COLUMNS, (list_id,))
        observation_list = cursor.fetchone()

        if observation_list is None:
            return jsonify({"error": "Observation list not found"}), 404

        # First Advanced Query (See below)
        cursor.execute(LIST_METADATA_QUERY, {"list_id": list_id})
        summary = cursor.fetchall()

        # A list with no coordinates can't be checked against a horizon, so
        # the second query is skipped rather than fed a fake location.
        if latitude is not None and longitude is not None:

            # Second Advanced Query (See below)
            cursor.execute(LIST_VISIBILITY_QUERY, {
                "list_id": list_id,
                "lat": latitude,
                "lon": longitude,
                "lst": local_sidereal_time(julian_date(now), longitude),
                "min_alt": 20,
            })
            visibility = cursor.fetchall()

        cursor.execute(objects_query, (list_id, limit, offset))
        objects = cursor.fetchall()

        cursor.execute(count_query, (list_id,))
        total = cursor.fetchone()['total']

    conn.commit()
```

### First Advanced query of 2 — `sql/transactions/ListMetadataByCategory.sql`

Joins three relations and aggregates with `GROUP BY`. `HAVING` drops categories
the user has finished, so the result answers "what is left to observe."

```sql
SELECT ObjectCategory,
       COUNT(ObjectID) AS TotalSaved,
       SUM(IsObserved) AS Observed,
       ROUND(SUM(IsObserved) / COUNT(ObjectID) * 100, 0)
           AS CompletionRate
FROM ObservationList
    NATURAL JOIN SavedObject
    NATURAL JOIN CelestialObject
WHERE ListID = %(list_id)s
GROUP BY ObjectCategory
HAVING CompletionRate < 100
ORDER BY CompletionRate DESC;
```

### Advanced query 2 of 2 — `sql/transactions/ListVisibilityByCategory.sql`

A CTE containing a subquery that cannot be rewritten as a join, joined to two relations and aggregated with `GROUP BY`.

Every object on the list is counted; the light pollution and horizon tests
narrow the later columns rather than filtering rows out. Putting either test in
the `WHERE` clause would make `OnList` report the surviving rows rather than
the list's real size.

```sql
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

```
---

**In the application:** both results render in the "Progress & tonight's sky"
panel at the top of a list in the My Lists tab. Ticking an object observed re-runs the transaction, so the counts visibly move.

---

## 2. Stored procedures

Two procedures are wired to routes. Live copies are on GCP.

### 2a. `AddConstellationToList`

Reached by `POST /api/lists/<list_id>/constellations` (`app/routes/constellations.py`).
Saves a constellation's bright stars in one call and reports what the user just added.

Contains control structures (`IF`), a raised exception, and two aggregate queries.

There is no `Constellation` table, and `CelestialObject.Constellation` merely names the region of sky a star sits in, so primary membership is approximated as the brightest stars in that region.

```sql
CREATE PROCEDURE AddConstellationToList(
    IN parListID INT,
    IN parConstellation VARCHAR(250),
    IN parMaxMagnitude FLOAT
)
BEGIN
    DECLARE varLatitude DOUBLE;
    DECLARE varLongitude DOUBLE;
    DECLARE varStarCount INT;
    DECLARE varVisibleCount INT;
    DECLARE varAdded INT;

    -- Visibility is judged from where the list is, not where the user is.
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
    -- single duplicate would kill the whole INSERT.
    INSERT INTO SavedObject (ListID, ObjectID)
    SELECT parListID, c.ObjectID
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
END;
```
---

**In the application:** the "Add to my list" button on each constellation card
in the Constellations tab.

---

### 2b. `SearchVisibleCelestialObjects`

Reached by `GET /api/visible-search` (`app/routes/search.py`). Backs the
"Visible tonight" toggle on the Explore tab.

Builds a `LIKE` pattern with control structures, then joins `CelestialObject`
to a three-way `INTERSECT` of ID sets: objects matching the keyword and
category, objects currently above the minimum altitude, and objects bright
enough to beat the local light pollution. Uses a set operator, a subquery, a
join, and a window function for the total.

```sql
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

END;
```
---

**In the application:** the "Visible tonight" slider on each the main
Explore tab.

---

## 3. Triggers

All three fire on ordinary user actions in the application.

### 3a. `CreateDefaultObservationList` — event `AFTER INSERT ON Users`

Every new account automatically gets a list to add CelestialObjects to.
Fires on `POST /api/users`, i.e. signing up.

```sql
CREATE TRIGGER CreateDefaultObservationList
AFTER INSERT ON Users
FOR EACH ROW
BEGIN
    IF NEW.Name IS NULL OR TRIM(NEW.Name) = '' THEN

        INSERT INTO ObservationList (
            UserID,
            Latitude,
            Longitude,
            ListName
        )
        VALUES (
            NEW.UserID,
            NULL,
            NULL,
            'My First Observation List'
        );

    ELSE

        INSERT INTO ObservationList (
            UserID,
            Latitude,
            Longitude,
            ListName
        )
        VALUES (
            NEW.UserID,
            NULL,
            NULL,
            CONCAT(TRIM(NEW.Name), '''s Observation List')
        );

    END IF;
END;
```
---

**In the application:** sign up, then open My Lists — the list is already there.

---

### 3b. `TrimObservationListName` — event `BEFORE INSERT ON ObservationList`

Fires on `POST /api/lists`. The create dialog sends whatever was typed by the user, and the route re-reads the row afterwards so the trigger's output is what the user sees.

```sql
CREATE TRIGGER TrimObservationListName
BEFORE INSERT ON ObservationList
FOR EACH ROW
BEGIN
    IF NEW.ListName IS NULL OR TRIM(NEW.ListName) = '' THEN
        SET NEW.ListName = 'Untitled Observation List';
    ELSE
        SET NEW.ListName = TRIM(NEW.ListName);
    END IF;
END
```
---

**In the application:** create a list named `"  Backyard  "` and the card reads
`Backyard`; leave the name empty and it comes back `Untitled Observation List`.

---

### 3c. `TrimCommunityReport` — event `BEFORE INSERT ON CommunityReport`

Fires on `POST /api/reports`.

```sql
CREATE TRIGGER TrimCommunityReport
BEFORE INSERT ON CommunityReport
FOR EACH ROW
BEGIN
    IF NEW.ReportText IS NOT NULL THEN
        SET NEW.ReportText = TRIM(NEW.ReportText);
    END IF;
END
```
---

**In the application:** post a report with leading or trailing whitespace and it
comes back trimmed.

---

## 4. Constraints

Beyond the primary and foreign keys, the schema carries tuple- and attribute-level `CHECK` constraints and a multi-column `UNIQUE`.

The application deliberately does not pre-empt these. The routes let the database reject the write and pass the message back, so a violation is visible in the UI rather than prevented before it happens.

### `sql/constraints/UniqueObservationListName.sql`

```sql
ALTER TABLE ObservationList
ADD CONSTRAINT uq_observation_list_user_name
UNIQUE (
    UserID,
    ListName
);
```

### `sql/constraints/ObservationListCoordinateConstraints.sql`

```sql
ALTER TABLE ObservationList
ADD CONSTRAINT chk_observation_list_latitude
CHECK (
    Latitude IS NULL
    OR Latitude BETWEEN -90 AND 90
);

ALTER TABLE ObservationList
ADD CONSTRAINT chk_observation_list_longitude
CHECK (
    Longitude IS NULL
    OR Longitude BETWEEN -180 AND 180
);
```

### `sql/constraints/CommunityReportConstraints.sql`

```sql
ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_not_empty
CHECK (
    ReportText IS NOT NULL
    AND CHAR_LENGTH(TRIM(ReportText)) > 0
);

ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_latitude
CHECK (
    Latitude IS NULL
    OR Latitude BETWEEN -90 AND 90
);

ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_longitude
CHECK (
    Longitude IS NULL
    OR Longitude BETWEEN -180 AND 180
);
```

## 5. Advanced queries that live in Python

Two of the project's three published advanced queries are executed directly by
their routes rather than through a procedure, so they do not appear in `sql/`.

### Submitted Query 1 — constellation visibility (`app/routes/constellations.py`)

Two CTEs, an aggregate with `GROUP BY`, a `LEFT JOIN` between them, and a
nearest-three-observations subquery that cannot be replaced by a join.
Reached by `GET /api/constellations`, which backs the Constellations tab ranking.

**Note:** This shares the nearest-three-observations subquery with `AddConstellationToList` (2a) as it is the project's definition of "how dark is it here," and both applications depend on it. The queries around it differ: this one groups across every constellation to rank them, while the procedure computes the same two counts for a single constellation without grouping, since it needs them as scalars before inserting.

```sql
WITH TotalStars AS (
        -- Table 1: Counts every significant star in each constellation
        SELECT Constellation,
               COUNT(ObjectID) AS StarCount
        FROM CelestialObject
        WHERE Constellation IS NOT NULL
            AND Constellation != ''
            AND Magnitude < %(max_mag)s   -- The 'connect the dots' stars
        GROUP BY Constellation
    ),
    VisibleStars AS (
        -- Table 2: Only count the stars brighter than the local light pollution
        SELECT Constellation,
               COUNT(ObjectID) AS StarsVisible
        FROM CelestialObject
        WHERE Constellation IS NOT NULL
            AND Constellation != ''
            AND Magnitude < %(max_mag)s   -- The 'connect the dots' stars
            AND Magnitude <= (
                -- Find the closest local average limiting magnitude
                -- If NULL, defaults to surburban/rural average of 6
                SELECT COALESCE(AVG(LimitingMag), 6)
                FROM (
                    -- Limit calculation to the 3 closest light pollution observations
                    SELECT LimitingMag
                    FROM LightPollutionObservation
                    -- 10 land miles = (approx) 0.1448 degrees latitude shift
                    WHERE Latitude BETWEEN %(lat)s - 0.1448 AND %(lat)s + 0.1448
                        AND Longitude BETWEEN
                            %(lon)s - 10 / 69.17 * COS(RADIANS(%(lat)s))
                            AND %(lon)s + 10 / 69.17 * COS(RADIANS(%(lat)s))
                    ORDER BY ABS(%(lat)s - Latitude),
                             ABS(%(lon)s - Longitude)
                    LIMIT 3
                ) AS ThreeClosest
            )
        GROUP BY Constellation
    )
    -- Join and format constellation visibility as a percentage
    SELECT
        t.Constellation,
        COALESCE(StarsVisible, 0) AS VisibleCount,
        StarCount,
        CONCAT(ROUND((COALESCE(StarsVisible, 0) / StarCount) * 100, 0), '%')
            AS VisibilityPercentage
    FROM TotalStars t
        LEFT JOIN VisibleStars USING (Constellation)
    ORDER BY (VisibleCount / StarCount) DESC,
             StarCount DESC;
```
---

**In Application:** the constellations' ranking and display on the Constellations tab.

---

### Submitted Query 3 — nearby community reports (`app/routes/nearby_reports.py`)

Joins three relations, aggregates with `GROUP BY`, and reports the light pollution measured around each community report. Reached by `GET /api/reports/nearby`.

Since the design submission, Chicago's hardcoded coordinates became named parameters, and `Users` was joined in for the author's name. The `SELECT` also carries `ReportID`, coordinates, `MilesAway`, and `DaysAgo` for the page to render; the grouping and aggregates are unchanged.

```sql
SELECT c.ReportID,
       c.ReportText,
       u.Name AS UserName,
       c.Latitude,
       c.Longitude,
       c.CreatedAt,
       DATEDIFF(NOW(), c.CreatedAt) AS DaysAgo,
       -- Same 69.17 miles per degree the box predicates below use
       ROUND(SQRT(POW((c.Latitude - %(lat)s) * 69.17, 2)
           + POW((c.Longitude - %(lon)s) * 69.17
           * COS(RADIANS(%(lat)s)), 2)), 1) AS MilesAway,
       COALESCE(AVG(l.LimitingMag), 6) AS AvgLimitingMag,
       COUNT(l.LimitingMag) AS NearbyObservations
FROM CommunityReport c
    -- Combine all CommunityReports with any LightPollutionObservations
    -- within 10 miles
    LEFT JOIN Users u ON u.UserID = c.UserID
    -- Combine all CommunityReports with any LightPollutionObservations
    -- within 10 miles
    LEFT JOIN LightPollutionObservation l
        -- 10 land miles = (approx) 0.1448 degrees latitude shift
        ON l.Latitude BETWEEN c.Latitude - 0.1448 AND c.Latitude + 0.1448
        -- longitude shift scaled by latitude for Earth's curvature
        AND l.Longitude BETWEEN
            c.Longitude - 10 / 69.17 * COS(RADIANS(c.Latitude))
            AND c.Longitude + 10 / 69.17 * COS(RADIANS(c.Latitude))
-- Filter only CommunityReports within 10 miles of the observer
WHERE c.Latitude BETWEEN %(lat)s - 0.1448 AND %(lat)s + 0.1448
    AND c.Longitude BETWEEN
        %(lon)s - 10 / 69.17 * COS(RADIANS(%(lat)s))
        AND %(lon)s + 10 / 69.17 * COS(RADIANS(%(lat)s))
GROUP BY c.ReportID,
            c.ReportText,
            u.Name,
            c.Latitude,
            c.Longitude,
            c.CreatedAt
ORDER BY DaysAgo;
```
---

**In Application:** "Nearby" view of the Community tab.

---
