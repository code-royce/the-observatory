# Advanced Database Programs

The transaction, stored procedures, triggers, and constraints used by
**The Observatory** (Light Pollution Analytics and Celestial Visibility
Planner), collected in one place as the Stage 4 rubric asks.

Each item is followed by the route that reaches it, so every program below can
be triggered from the running application.

The canonical copies live in `sql/`, next to the code that loads them. This
file is a duplicate for review — `app/routes/lists.py` reads
`sql/transactions/*.sql` off disk at import, so those files cannot be moved.

**Schema note.** `SavedObject` originally carried a single
`ObservedStatus VARCHAR(250)` holding either `'seen'`/`'not seen'` or a
freeform note. Because the metadata query counts `ObservedStatus = 'seen'`,
writing a note silently un-observed the row. It was replaced with
`IsObserved BOOLEAN NOT NULL DEFAULT FALSE` and `Notes VARCHAR(250) NULL` —
see `sql/migrations/001_saved_object_is_observed.sql`.

---

## 1. Transaction

**Isolation level: `REPEATABLE READ`.** Reached by `GET /api/lists/<list_id>`
(`app/routes/lists.py`, `list_detail()`), which the frontend calls whenever a
user opens one of their observation lists.

The route returns three things that describe one list: a per-category progress
summary, per-category visibility counts, and a total row count. They come from
separate statements and cannot be derived from one another — the metadata
query's `HAVING` clause deliberately drops finished categories, so its counts
do not sum to the total. `REPEATABLE READ` is what makes it honest to present
them together: every statement in the transaction reads the same snapshot, so
the three cannot disagree because someone added an object midway through.

It is a read transaction. Nothing is written, but the snapshot stays open until
the transaction ends, so it is committed explicitly rather than left to the
connection closing.

### Transaction control (`app/routes/lists.py`)

```python
with get_db_connection() as conn:
    conn.start_transaction(isolation_level='REPEATABLE READ')

    with conn.cursor(dictionary=True) as cursor:
        cursor.execute(LIST_COLUMNS, (list_id,))
        observation_list = cursor.fetchone()

        if observation_list is None:
            # Nothing was written, and closing the connection discards the
            # open snapshot, so there is nothing to roll back.
            return jsonify({"error": "Observation list not found"}), 404

        cursor.execute(LIST_METADATA_QUERY, {"list_id": list_id})
        summary = cursor.fetchall()

        # A list with no coordinates can't be checked against a horizon, so
        # the second query is skipped rather than fed a fake location.
        if latitude is not None and longitude is not None:
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

### Advanced query 1 of 2 — `sql/transactions/ListMetadataByCategory.sql`

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

A CTE containing a subquery that cannot be rewritten as a join — the
nearest-observations lookup selects rows by proximity rank via
`ORDER BY ... LIMIT`, not by a join condition — joined to two relations and
aggregated with `GROUP BY`.

Every object on the list is counted; the light pollution and horizon tests
narrow the later columns rather than filtering rows out. Putting either test in
the `WHERE` clause would make `OnList` report the surviving rows rather than
the list's real size.

```sql
WITH LocalLimit AS (
    -- Faintest magnitude visible here, averaged over the three nearest
    -- light pollution observations within roughly 10 miles.
    SELECT COALESCE(AVG(LimitingMag), 6) AS LimitingMag
    FROM (
        SELECT LimitingMag
        FROM LightPollutionObservation
        WHERE Latitude BETWEEN %(lat)s - 0.1448 AND %(lat)s + 0.1448
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
           AND DEGREES(ASIN(
               SIN(RADIANS(c.Declination)) * SIN(RADIANS(%(lat)s))
               + COS(RADIANS(c.Declination)) * COS(RADIANS(%(lat)s))
                   * COS(RADIANS(%(lst)s - c.RightAscension * 15))
           )) > %(min_alt)s
       ) AS UpNow
FROM SavedObject s
    JOIN CelestialObject c ON c.ObjectID = s.ObjectID
    CROSS JOIN LocalLimit l
WHERE s.ListID = %(list_id)s
GROUP BY c.ObjectCategory
ORDER BY UpNow DESC, OnList DESC;
```

**In the application:** both results render in the "Progress & tonight's sky"
panel at the top of a list (`the-observatory/src/components/ListProgress.tsx`).
Ticking an object observed re-runs the transaction, so the counts visibly move.

---

## 2. Stored procedures

Two procedures are wired to routes. Three further files exist in
`sql/stored_procedures/` — `CreateCommunityReport.sql`,
`CreateObservationList.sql`, and `SaveObjectToList.sql` — which are **not**
called by any route; the equivalent inserts are issued directly, and a bulk
insert is used where they would have meant one statement per object.

### 2a. `AddConstellationToList`

Reached by `POST /api/lists/<list_id>/constellations`
(`app/routes/constellations.py`). Saves a whole constellation's bright stars in
one call and reports what the user just got.

Contains control structures (`IF`), a raised exception, and two aggregate
queries. There is no `Constellation` table —
`CelestialObject.Constellation` names the region of sky a star sits in, so
membership is approximated as the brightest stars in that region.

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
            SELECT COALESCE(AVG(LimitingMag), 6) AS LimitingMag
            FROM (
                SELECT LimitingMag
                FROM LightPollutionObservation
                WHERE Latitude BETWEEN varLatitude - 0.1448
                                   AND varLatitude + 0.1448
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
    IF varStarCount = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No constellation matches that code';
    END IF;

    -- Stars already on the list are filtered out rather than left to
    -- collide: (ListID, ObjectID) is SavedObject's primary key, and a
    -- single duplicate would abort the INSERT, adding none of the rest.
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
END
```

**In the application:** the "Add to my list" button on each constellation card
in the Constellations tab. The `SIGNAL` surfaces as a 404, and `SavedObject`'s
foreign key rejection surfaces as a 404 for a missing list.

### 2b. `SearchVisibleCelestialObjects`

Reached by `GET /api/visible-search` (`app/routes/search.py`). Backs the
"Visible tonight" toggle on the Explore tab.

Builds a `LIKE` pattern with control structures, then joins `CelestialObject`
to a three-way `INTERSECT` of ID sets: objects matching the keyword and
category, objects currently above the minimum altitude, and objects bright
enough to beat the local light pollution. Uses a set operator, a subquery, a
join, and a window function for the total.

The full text is in `sql/stored_procedures/SearchVisibleCelestialObjects.sql`;
its shape is:

```sql
CREATE PROCEDURE SearchVisibleCelestialObjects(
    IN p_Keyword VARCHAR(250), IN p_CategoryCodes TEXT,
    IN p_Latitude DOUBLE, IN p_Longitude DOUBLE,
    IN p_LocalSiderealTime DOUBLE, IN p_MinAltitude DOUBLE,
    IN p_Limit INT, IN p_Offset INT
)
BEGIN
    DECLARE v_Keyword VARCHAR(250);
    DECLARE v_LikePattern VARCHAR(252);

    SET v_Keyword = TRIM(COALESCE(p_Keyword, ''));
    IF v_Keyword = '' THEN
        SET v_LikePattern = '%';
    ELSE
        SET v_LikePattern = CONCAT('%', v_Keyword, '%');
    END IF;

    SELECT c.ObjectID, c.Name, ..., COUNT(*) OVER() AS total
    FROM CelestialObject c JOIN (
        SELECT ObjectID FROM CelestialObject WHERE /* keyword + category */
        INTERSECT
        SELECT ObjectID FROM ( /* altitude above p_MinAltitude */ ) AS visible
        INTERSECT
        SELECT ObjectID FROM CelestialObject WHERE /* magnitude vs local limit */
    ) AS MatchingObjectIDs ON c.ObjectID = MatchingObjectIDs.ObjectID
    ORDER BY (c.Magnitude = 0), c.Magnitude, Altitude DESC, c.ObjectID
    LIMIT p_Limit OFFSET p_Offset;
END
```

---

## 3. Triggers

All three fire on ordinary user actions in the application.

### 3a. `CreateDefaultObservationList` — event `AFTER INSERT ON Users`

Every new account gets a list to put things in, named after the user when they
gave a name. Fires on `POST /api/users`, i.e. signing up.

```sql
CREATE TRIGGER CreateDefaultObservationList
AFTER INSERT ON Users
FOR EACH ROW
BEGIN
    IF NEW.Name IS NULL OR TRIM(NEW.Name) = '' THEN
        INSERT INTO ObservationList (UserID, Latitude, Longitude, ListName)
        VALUES (NEW.UserID, NULL, NULL, 'My First Observation List');
    ELSE
        INSERT INTO ObservationList (UserID, Latitude, Longitude, ListName)
        VALUES (NEW.UserID, NULL, NULL,
                CONCAT(TRIM(NEW.Name), '''s Observation List'));
    END IF;
END
```

**In the application:** sign up, then open My Lists — the list is already there.

### 3b. `TrimObservationListName` — event `BEFORE INSERT ON ObservationList`

Fires on `POST /api/lists`. The route deliberately does **not** check the name,
so both branches are reachable from the UI: the create dialog sends whatever
was typed, and the route re-reads the row afterwards so the trigger's output is
what the user sees.

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

**In the application:** create a list named `"  Backyard  "` and the card reads
`Backyard`; leave the name empty and it comes back `Untitled Observation List`.

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

**In the application:** post a report with leading or trailing whitespace and it
comes back trimmed.

---

## 4. Constraints

Beyond the primary and foreign keys, the schema carries tuple- and
attribute-level `CHECK` constraints and a multi-column `UNIQUE`. The
application deliberately does not pre-empt these — the route lets the database
reject the write and passes the message back, so a violation is visible in the
UI rather than prevented before it happens.

### `sql/constraints/UniqueObservationListName.sql`

```sql
ALTER TABLE ObservationList
ADD CONSTRAINT uq_observation_list_user_name
UNIQUE (UserID, ListName);
```

`create_list` and `update_list` map the resulting `ER_DUP_ENTRY` to a **409**
with the message *"This user already has a list named 'X'."*, which the
frontend shows as a toast.

### `sql/constraints/ObservationListCoordinateConstraints.sql`

```sql
ALTER TABLE ObservationList
ADD CONSTRAINT chk_observation_list_latitude
CHECK (Latitude IS NULL OR Latitude BETWEEN -90 AND 90);

ALTER TABLE ObservationList
ADD CONSTRAINT chk_observation_list_longitude
CHECK (Longitude IS NULL OR Longitude BETWEEN -180 AND 180);
```

Nullable because a list need not have a location; range-checked when it does.

### `sql/constraints/CommunityReportConstraints.sql`

```sql
ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_not_empty
CHECK (ReportText IS NOT NULL AND CHAR_LENGTH(TRIM(ReportText)) > 0);

ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_latitude
CHECK (Latitude IS NULL OR Latitude BETWEEN -90 AND 90);

ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_longitude
CHECK (Longitude IS NULL OR Longitude BETWEEN -180 AND 180);
```

Note this constraint runs *after* `TrimCommunityReport`, so a report of nothing
but spaces is trimmed to empty and then rejected.

### Referential actions worth naming

- `SavedObject.ListID` → `ObservationList` **ON DELETE CASCADE**. Deleting a
  list removes its saved objects; no application code deletes them.
- `CommunityReport.UserID` → `Users` **ON DELETE SET NULL**. A deleted account's
  reports survive without an author, which is why `GET /api/reports` uses a
  `LEFT JOIN` and the UI renders "Deleted user".
- `SavedObject` primary key is `(ListID, ObjectID)`, which is what makes
  re-adding an object a duplicate-key event rather than a second row.

### Demonstrating them

| Action in the UI | Constraint that fires |
|---|---|
| Rename a list to another of your list's names | `uq_observation_list_user_name` → 409 |
| Create a list with latitude `999` | `chk_observation_list_latitude` |
| Post a report containing only spaces | `chk_community_report_not_empty` |
| Add an object already on the list | `SavedObject` PK, absorbed by `ON DUPLICATE KEY UPDATE` |
| Delete a list holding objects | `ON DELETE CASCADE` |

---

## 5. Advanced queries that live in Python

Two of the project's three published advanced queries are executed directly by
their routes rather than through a procedure, so they do not appear in `sql/`.
They are included here because they carry the "two advanced SQL concepts"
requirement alongside the transaction.

### Query 1 — constellation visibility (`app/routes/constellations.py`)

Two CTEs, an aggregate with `GROUP BY`, a `LEFT JOIN` between them, and a
nearest-three-observations subquery that cannot be replaced by a join. Reached
by `GET /api/constellations`, which backs the Constellations tab ranking.

```sql
WITH TotalStars AS (
    SELECT Constellation, COUNT(ObjectID) AS StarCount
    FROM CelestialObject
    WHERE Constellation IS NOT NULL AND Constellation != ''
        AND Magnitude < %(max_mag)s
    GROUP BY Constellation
),
VisibleStars AS (
    SELECT Constellation, COUNT(ObjectID) AS StarsVisible
    FROM CelestialObject
    WHERE Constellation IS NOT NULL AND Constellation != ''
        AND Magnitude < %(max_mag)s
        AND Magnitude <= (
            SELECT COALESCE(AVG(LimitingMag), 6)
            FROM (
                SELECT LimitingMag
                FROM LightPollutionObservation
                WHERE Latitude BETWEEN %(lat)s - 0.1448 AND %(lat)s + 0.1448
                    AND Longitude BETWEEN
                        %(lon)s - 10 / 69.17 * COS(RADIANS(%(lat)s))
                        AND %(lon)s + 10 / 69.17 * COS(RADIANS(%(lat)s))
                ORDER BY ABS(%(lat)s - Latitude), ABS(%(lon)s - Longitude)
                LIMIT 3
            ) AS ThreeClosest
        )
    GROUP BY Constellation
)
SELECT t.Constellation,
       COALESCE(StarsVisible, 0) AS VisibleCount,
       StarCount,
       CONCAT(ROUND((COALESCE(StarsVisible, 0) / StarCount) * 100, 0), '%')
           AS VisibilityPercentage
FROM TotalStars t
    LEFT JOIN VisibleStars USING (Constellation)
ORDER BY (VisibleCount / StarCount) DESC, StarCount DESC
```

### Query 3 — nearby community reports (`app/routes/nearby_reports.py`)

Joins three relations, aggregates with `GROUP BY`, and reports the light
pollution measured around each report. Reached by `GET /api/reports/nearby`,
which backs the "Nearby" view of the Community tab. The full text is in
`app/routes/nearby_reports.py` as `NEARBY_REPORTS_QUERY`.

It uses `LEFT JOIN Users` rather than the inner join used elsewhere,
deliberately: `CommunityReport.UserID` is nullable, so an inner join would drop
reports whose author has since deleted their account.

Its light-pollution figures count `COUNT(LimitingMag)` rather than
`COUNT(ObservationID)`, because 2,908 rows in `LightPollutionObservation` used
`0.0` as a missing-data sentinel and were set to `NULL`. Counting rows instead
of readings would report an average of 0.0 for cities.
