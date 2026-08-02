from flask import Blueprint, jsonify, request

from app.utils import get_db_connection, handle_db_errors

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/reports', methods=['GET'])
@handle_db_errors
def reports():
    """
    Returns all tuples form the CommunityReport table

    Returns:
        JSON response containing:
            - data: list of all community reports as dictionaries
            - total: total number of results
            - page: current page number
            - limit: number of results per page
    """
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 48))
    offset = (page - 1) * limit

    # Query to get all community reports, with pagination.
    # LEFT JOIN, not NATURAL JOIN: CommunityReport.UserID is ON DELETE SET
    # NULL, so a deleted user's reports survive without an author. An inner
    # join would drop them while the count below still counted them, leaving
    # the pager short a row per orphaned report.
    query_reports = f"""
        SELECT ReportID, UserID, Name AS UserName, Latitude, Longitude,
               CreatedAt, ReportText
        FROM CommunityReport LEFT JOIN Users USING (UserID)
        ORDER BY CreatedAt DESC
        LIMIT %s
        OFFSET %s"""

    # Get total count to help React manage pagination
    count_query = f"""
        SELECT COUNT(*) AS total
        FROM CommunityReport"""

    # Use the above to query the gcp database
    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query_reports, (limit, offset))
            reports_results = cursor.fetchall()

            cursor.execute(count_query)
            total = cursor.fetchone()['total']

    return jsonify({
        "data": reports_results,
        "total": total,
        "page": page,
        "limit": limit
    })

@reports_bp.route('/reports', methods=['POST'])
@handle_db_errors
def create_report():
    """
    Creates a new CommunityReport.

    Expects a JSON body containing:
        - user_id: int (FK to Users), required for new reports
        - latitude: float, required
        - longitude: float, required
        - report_text: str, required

    Returns:
        JSON response containing the newly created report as a dictionary.
    """
    body = request.get_json(silent=True) or {}

    user_id = body.get('user_id')
    latitude = body.get('latitude')
    longitude = body.get('longitude')
    report_text = body.get('report_text')

    errors = []

    # Type validation
    if latitude is not None:
        try:
            latitude = float(latitude)
        except (TypeError, ValueError):
            errors.append("latitude must be a number")
    if longitude is not None:
        try:
            longitude = float(longitude)
        except (TypeError, ValueError):
            errors.append("longitude must be a number")
    if user_id is not None:
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            errors.append("user_id must be an integer")

    if errors:
        return jsonify({"errors": errors}), 400

    insert_query = """
        INSERT INTO CommunityReport (UserID, Latitude, Longitude, ReportText)
        VALUES (%s, %s, %s, %s)"""

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(
                insert_query,
                (user_id, latitude, longitude, report_text)
            )
            new_id = cursor.lastrowid
            conn.commit()

            cursor.execute(
                """
                SELECT ReportID, UserID, Name AS UserName, Latitude, Longitude,
                       CreatedAt, ReportText
                FROM CommunityReport LEFT JOIN Users USING (UserID)
                WHERE ReportID = %s
                """,
                (new_id,)
            )
            new_report = cursor.fetchone()

    return jsonify({"data": new_report}), 201
