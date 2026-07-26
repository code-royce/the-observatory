from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from app.horizon_calculator import julian_date, local_sidereal_time
from app.utils import get_db_connection, handle_db_errors

visibility_bp = Blueprint('visibility', __name__)


@visibility_bp.route('/visible', methods=['GET'])
@handle_db_errors
def visible():
    """
    Lists CelestialObjects currently above the horizon for a given
    location and moment in time, paginated.

    [TO CONSIDER]
    Pagination and time: each call re-parses `datetime` independently,
    so if it's omitted, "now" gets computed fresh every time. That's
    fine for a single page, but has implications to considerfor a caller
    paging through multiple pages of the same list:
        - As-is: omit `datetime` on every page. Simplest, but each page
          reflects a slightly different moment. LST keeps advancing
          between requests, so the "currently visible" set can shift,
          and an object may get skipped, duplicated, or reordered from
          one page to the next.
        - Static: capture the `datetime` this route returns on page
          1, then pass that same value back explicitly on every later
          page (`page=2`, `page=3`, ...). This pins every page to the
          exact same moment, so the paginated list stays stable --
          important for something like building an Observation List,
          where a shifting result set would be confusing.

    Args:
        lat (float): Observer's latitude in degrees. Required.
        lon (float): Observer's longitude in degrees, east-positive.
            Required.
        datetime (str): Timestamp to check visibility at, e.g.
            "2026-07-25T20:00:00Z". Optional -- defaults to right now,
            UTC. A timestamp with no timezone offset is assumed to
            already be UTC.
        page (int): Page number (default 1).
        limit (int): Results per page (default 48).

    Returns:
        JSON response containing:
            - data: Visible CelestialObjects on this page, brightest
              (lowest Magnitude) first, each with an added Altitude
              field (degrees). Objects with Magnitude == 0 (a data
              placeholder for missing values, not a real measurement)
              are pushed to the end rather than excluded.
            - total: Total number of currently-visible objects matching
              the magnitude/altitude thresholds.
            - page, limit: The pagination that was applied.
            - lat, lon: The location that was checked.
            - datetime: The UTC timestamp that was checked, ISO 8601.
    """
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon are required"}), 400

    when = _parse_datetime(request.args.get('datetime'))
    if when is None:
        return jsonify(
            {"error": "datetime must be a valid ISO 8601 timestamp"}
        ), 400

    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 48))
    offset = (page - 1) * limit

    lst = local_sidereal_time(julian_date(when), lon)

    limiting_mag = 14.0   # Visible with a backyard telescope
    min_alt = 20          # Above trees, buildings, atmospheric refraction

    # Same altitude formula as horizon_calculator.altitude(), translated
    # to SQL so MySQL computes and filters it per-row instead of Python
    # looping over every candidate object.
    altitude_expr = f"""
        DEGREES(ASIN(
            SIN(RADIANS(Declination)) * SIN(RADIANS({lat}))
            + COS(RADIANS(Declination)) * COS(RADIANS({lat}))
                * COS(RADIANS({lst} - RightAscension * 15))
        ))
    """

    query = f"""
        SELECT *, {altitude_expr} AS Altitude
        FROM CelestialObject
        WHERE Declination BETWEEN {lat} - 90 AND {lat} + 90
            AND Magnitude <= {limiting_mag}
        HAVING Altitude > {min_alt}
        ORDER BY (Magnitude = 0), Magnitude, Altitude DESC, ObjectID
        LIMIT {limit} OFFSET {offset}
    """

    # Same WHERE/HAVING as above, so the total matches what's actually
    # paginated. Mirrors search.py's separate count_query pattern.
    count_query = f"""
        SELECT COUNT(*) AS total
        FROM (
            SELECT {altitude_expr} AS Altitude
            FROM CelestialObject
            WHERE Declination BETWEEN {lat} - 90 AND {lat} + 90
                AND Magnitude <= {limiting_mag}
            HAVING Altitude > {min_alt}
        ) AS visible_objects
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()

            cursor.execute(count_query)
            total = cursor.fetchone()['total']

    for row in rows:
        row['Altitude'] = round(row['Altitude'], 2)

    return jsonify({
        "data": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "lat": lat,
        "lon": lon,
        "datetime": when.isoformat(),
    })


def _parse_datetime(value: str | None) -> datetime | None:
    """
    Parses a timestamp query param into a UTC datetime.

    Args:
        value: The raw query string value, or None if the param was
            omitted.

    Returns:
        The current UTC time if value is None; the parsed timestamp
        converted to UTC if value is valid; None if value couldn't be
        parsed.
    """
    if value is None:
        return datetime.now(timezone.utc)

    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)
