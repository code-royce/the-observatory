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

    # Query to get all community reports, with pagination
    query_reports = f"""
        SELECT ReportID, UserID, Name AS UserName, Latitude, Longitude,
               CreatedAt, ReportText
        FROM CommunityReport NATURAL JOIN Users
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
