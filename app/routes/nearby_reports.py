from flask import Blueprint, jsonify, request

from app.utils import get_db_connection, handle_db_errors

nearby_reports_bp = Blueprint('nearby_reports', __name__)

# Query 3 ("community reports near a given location") from
# doc/Database Design.pdf, with Chicago's hardcoded coordinates replaced by
# named parameters. Named rather than positional because lat appears four
# times and lon three.
NEARBY_REPORTS_QUERY = """
    SELECT ReportText,
           CreatedAt,
           DATEDIFF(NOW(), CreatedAt) AS DaysAgo,
           COALESCE(AVG(LimitingMag), 6) AS AvgLimitingMag,
           COUNT(ObservationID) AS NearbyObservations
    FROM CommunityReport c
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
    GROUP BY ReportID,
             ReportText,
             CreatedAt
    ORDER BY DaysAgo
"""


@nearby_reports_bp.route('/reports/nearby', methods=['GET'])
@handle_db_errors
def nearby_reports():
    """
    Returns the community reports written within about 10 miles of a
    location, newest first, each with the local light pollution measured
    around it.

    A report with no coordinates can never match, since the WHERE clause
    compares its Latitude and Longitude. CommunityReport allows both to be
    NULL, so reports created without a location are invisible here.

    Args:
        lat (float): Observer's latitude in degrees. Required.
        lon (float): Observer's longitude in degrees, east-positive.
            Required.

    Returns:
        JSON response containing:
            - data: one row per nearby report, each with ReportText,
              CreatedAt, DaysAgo (whole days since it was written),
              AvgLimitingMag (faintest magnitude visible around that report,
              averaged over the light pollution observations within 10 miles
              of it, defaulting to 6 where there are none), and
              NearbyObservations (how many observations that average covers,
              0 when none).
            - total: number of reports returned.
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
            cursor.execute(NEARBY_REPORTS_QUERY, {"lat": lat, "lon": lon})
            results = cursor.fetchall()

    # AVG() arrives as a Decimal, which Flask serializes as a JSON string
    # ("5.5", not 5.5). Convert so the frontend gets a number.
    for row in results:
        row['AvgLimitingMag'] = round(float(row['AvgLimitingMag']), 2)

    return jsonify({
        "data": results,
        "total": len(results),
        "lat": lat,
        "lon": lon,
    })
