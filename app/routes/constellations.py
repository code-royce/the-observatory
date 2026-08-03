from flask import Blueprint, jsonify, request
from mysql.connector import DatabaseError, errorcode

from app.utils import get_db_connection, handle_db_errors

constellations_bp = Blueprint('constellations', __name__)

# Faintest star counted as part of a constellation. 3 is the value
# doc/Database Design.pdf published its figures against. Only 52 of the 88
# constellations have a star that bright.
DEFAULT_MAX_MAGNITUDE = 3

MAX_MAGNITUDE_ERROR = "max_magnitude must be a number between -2 and 15"

# Faintest star drawn on the star map, looser than the counting cutoff so a
# figure has enough stars to show its shape. Lyra's parallelogram needs 4.43.
# Cosmetic only, so it isn't exposed as a parameter.
STAR_MAP_MAGNITUDE = 4.5

# Stars drawn per constellation, brightest first. Orion has 27 at the cutoff
# above, and the faintest are background rather than part of the figure.
STAR_MAP_LIMIT = 20

CONSTELLATION_VISIBILITY_QUERY = """
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
             StarCount DESC
"""

CONSTELLATION_STARS_QUERY = """
    WITH LocalLimit AS (
        -- Faintest magnitude visible here, averaged over the three nearest
        -- light pollution observations within roughly 10 miles.
        SELECT COALESCE(AVG(LimitingMag), 6) AS LimitingMag
        FROM (
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
    SELECT c.Constellation,
           c.Name,
           c.RightAscension,
           c.Declination,
           c.Magnitude,
           -- Does this star beat the local light pollution?
           c.Magnitude <= l.LimitingMag AS Visible,
           -- Is it one of the stars the counts and the add button act on?
           c.Magnitude < %(count_mag)s AS IsMember
    FROM CelestialObject c
        -- Single-row CTE, so this attaches the local limit to every row
        -- without changing the row count.
        CROSS JOIN LocalLimit l
    WHERE c.Constellation IS NOT NULL
        AND c.Constellation != ''
        AND c.Magnitude < %(star_mag)s
    ORDER BY c.Constellation, c.Magnitude
"""


@constellations_bp.route('/constellations', methods=['GET'])
@handle_db_errors
def constellation_visibility():
    """
    Ranks every constellation by how much of it is visible from a given
    location, most visible first.

    Args:
        lat (float): Observer's latitude in degrees. Required.
        lon (float): Observer's longitude in degrees, east-positive.
            Required.
        max_magnitude (float): Faintest star to count as part of a
            constellation. Optional; defaults to 3, the value the design doc
            published. Higher includes more stars and more constellations.

    Returns:
        JSON response containing:
            - data: one row per constellation, each with Constellation (its
              name), VisibleCount (bright stars that beat the local light
              pollution), StarCount (bright stars it has in total),
              and VisibilityPercentage -- a string such as '63%', formatted
              that way by the query itself. Divide the two counts for a
              number.
            - total: number of constellations returned.
            - lat, lon: the location that was checked.
            - max_magnitude: the cutoff that was applied.
        A 400 if lat or lon is missing or out of range, or if max_magnitude
        isn't a number in range.
    """
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon are required"}), 400

    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        return jsonify({"error": (
            "lat must be between -90 and 90, lon between -180 and 180"
        )}), 400

    max_mag = _parse_max_magnitude(request.args.get('max_magnitude'))
    if max_mag is None:
        return jsonify({"error": MAX_MAGNITUDE_ERROR}), 400

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(
                CONSTELLATION_VISIBILITY_QUERY,
                {"lat": lat, "lon": lon, "max_mag": max_mag}
            )
            results = cursor.fetchall()

            cursor.execute(CONSTELLATION_STARS_QUERY, {
                "lat": lat,
                "lon": lon,
                "count_mag": max_mag,
                "star_mag": STAR_MAP_MAGNITUDE,
            })
            star_rows = cursor.fetchall()

    return jsonify({
        "data": results,
        "stars": _group_stars(star_rows),
        "total": len(results),
        "lat": lat,
        "lon": lon,
        "max_magnitude": max_mag,
        "star_magnitude": STAR_MAP_MAGNITUDE,
    })


@constellations_bp.route(
    '/lists/<int:list_id>/constellations', methods=['POST']
)
@handle_db_errors
def add_constellation(list_id):
    """
    Saves a whole constellation's bright stars to an ObservationList, via
    the AddConstellationToList stored procedure.

    There is no Constellation table -- a constellation is a set of
    CelestialObjects, so adding one means adding those objects as ordinary
    SavedObject rows. Everything that already reads a list keeps working
    without knowing a constellation was involved.

    Args:
        list_id (int): The ObservationList.ListID to add to, from the URL.

    Stars arrive unobserved -- SavedObject.IsObserved defaults to FALSE, so
    ticking them off afterwards is the user's job.

    Expects a JSON body containing:
        - constellation: str, required. The constellation name, e.g. "Orion".
        - max_magnitude: float, optional. Faintest star to treat as part of
          the constellation; defaults to 3. Pass the same value used to
          display the constellation, or the counts shown won't match what
          gets added.

    Returns:
        JSON response containing StarCount (bright stars the constellation
        has), VisibleCount (how many beat the light pollution at the list's
        location), Added, and AlreadyOnList, with a 201 status code. A 400
        if the body is invalid, or a 404 if no list has that ListID or no
        constellation matches that code.
    """
    body = request.get_json(silent=True) or {}

    constellation = body.get('constellation')

    errors = []
    if not constellation or not str(constellation).strip():
        errors.append("constellation is required")
    else:
        constellation = str(constellation).strip()

    max_mag = _parse_max_magnitude(body.get('max_magnitude'))
    if max_mag is None:
        errors.append(MAX_MAGNITUDE_ERROR)

    if errors:
        return jsonify({"errors": errors}), 400

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            try:
                cursor.callproc(
                    "AddConstellationToList",
                    (list_id, constellation, max_mag)
                )
            except DatabaseError as e:
                if e.errno == errorcode.ER_SIGNAL_EXCEPTION:
                    # The procedure SIGNALs on an unknown constellation.
                    return jsonify({"error": e.msg}), 404
                if e.errno == errorcode.ER_NO_REFERENCED_ROW_2:
                    # SavedObject's foreign key rejected the list.
                    return jsonify(
                        {"error": "Observation list not found"}
                    ), 404
                raise

            counts = {}
            for output in cursor.stored_results():
                counts = output.fetchone()

            conn.commit()

    return jsonify({"data": {
        "list_id": list_id,
        "constellation": constellation,
        "max_magnitude": max_mag,
        "star_count": counts['StarCount'],
        "visible_count": counts['VisibleCount'],
        "added": counts['Added'],
        "already_on_list": counts['AlreadyOnList'],
    }}), 201


def _group_stars(rows):
    """
    Turns the flat star rows into one list per constellation, for plotting.

    Args:
        rows (list[dict]): Rows from CONSTELLATION_STARS_QUERY, already
            ordered by constellation then magnitude.

    Returns:
        dict: Constellation name -> its stars, brightest first, capped at
            STAR_MAP_LIMIT. Constellation is dropped from each star since it
            is the key, and Visible/IsMember become real booleans -- MySQL
            returns comparisons as 0 and 1, which would reach the frontend as
            numbers.
    """
    grouped = {}

    for row in rows:
        stars = grouped.setdefault(row['Constellation'], [])

        # Rows arrive brightest first, so once a constellation is full the
        # rest of its stars are the faintest and safe to drop.
        if len(stars) >= STAR_MAP_LIMIT:
            continue

        stars.append({
            "Name": row['Name'],
            "RightAscension": row['RightAscension'],
            "Declination": row['Declination'],
            "Magnitude": row['Magnitude'],
            "Visible": bool(row['Visible']),
            "IsMember": bool(row['IsMember']),
        })

    return grouped


def _parse_max_magnitude(value):
    """
    Turns a max_magnitude from a query string or JSON body into a float.

    Args:
        value: The raw value, or None if it wasn't supplied.

    Returns:
        float: DEFAULT_MAX_MAGNITUDE if value is None, otherwise the parsed
            cutoff. None if value isn't a number or falls outside the range
            the catalog actually holds -- callers turn that into a 400.
    """
    if value is None:
        return DEFAULT_MAX_MAGNITUDE

    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None

    # Sirius, the brightest star in the catalog, sits at -1.46; nothing is
    # dimmer than about 15.
    if not -2 <= parsed <= 15:
        return None

    return parsed
