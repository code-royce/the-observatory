from flask import Blueprint, jsonify, request
from mysql.connector import DatabaseError, errorcode

from app.utils import get_db_connection, handle_db_errors

constellations_bp = Blueprint('constellations', __name__)

# Query 1 ("constellation visibility") from doc/Database Design.pdf, with
# Champaign's hardcoded coordinates replaced by named parameters. Named
# rather than positional because lat appears five times and lon three.
CONSTELLATION_VISIBILITY_QUERY = """
    WITH TotalStars AS (
        -- Table 1: Counts every significant star in each constellation
        SELECT Constellation,
               COUNT(ObjectID) AS StarCount
        FROM CelestialObject
        WHERE Constellation IS NOT NULL
            AND Constellation != ''
            AND Magnitude < 3       -- Only the bright 'connect the dots' stars
        GROUP BY Constellation
    ),
    VisibleStars AS (
        -- Table 2: Only count the stars brighter than the local light pollution
        SELECT Constellation,
               COUNT(ObjectID) AS StarsVisible
        FROM CelestialObject
        WHERE Constellation IS NOT NULL
            AND Constellation != ''
            AND Magnitude < 3       -- Only the bright 'connect the dots' stars
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
        CONCAT(ROUND((COALESCE(StarsVisible, 0) / StarCount) * 100, 0), '%%')
            AS VisibilityPercentage
    FROM TotalStars t
        LEFT JOIN VisibleStars USING (Constellation)
    ORDER BY (VisibleCount / StarCount) DESC,
             StarCount DESC
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
        A 400 if lat or lon is missing or out of range.
    """
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon are required"}), 400

    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        return jsonify({"error": (
            "lat must be between -90 and 90, lon between -180 and 180"
        )}), 400

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(
                CONSTELLATION_VISIBILITY_QUERY, {"lat": lat, "lon": lon}
            )
            results = cursor.fetchall()

    return jsonify({
        "data": results,
        "total": len(results),
        "lat": lat,
        "lon": lon,
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

    Expects a JSON body containing:
        - constellation: str, required. The constellation name, e.g. "Orion".
        - observed_status: str, optional. "seen" or "not seen"; defaults to
          "not seen".

    Returns:
        JSON response containing StarCount (bright stars the constellation
        has), VisibleCount (how many beat the light pollution at the list's
        location), Added, and AlreadyOnList, with a 201 status code. A 400
        if the body is invalid, or a 404 if no list has that ListID or no
        constellation matches that code.
    """
    body = request.get_json(silent=True) or {}

    constellation = body.get('constellation')
    observed_status = body.get('observed_status', 'not seen')

    errors = []
    if not constellation or not str(constellation).strip():
        errors.append("constellation is required")
    else:
        constellation = str(constellation).strip()

    # No CHECK constrains ObservedStatus, so this is the only thing keeping
    # arbitrary strings out of the column.
    observed_status = str(observed_status).strip().lower()
    if observed_status not in ('seen', 'not seen'):
        errors.append("observed_status must be 'seen' or 'not seen'")

    if errors:
        return jsonify({"errors": errors}), 400

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            try:
                cursor.callproc(
                    "AddConstellationToList",
                    (list_id, constellation, observed_status)
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
        "star_count": counts['StarCount'],
        "visible_count": counts['VisibleCount'],
        "added": counts['Added'],
        "already_on_list": counts['AlreadyOnList'],
    }}), 201