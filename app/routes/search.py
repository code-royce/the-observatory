from flask import Blueprint, jsonify, request
from markupsafe import escape

from app.utils import get_db_connection, handle_db_errors

search_bp = Blueprint('search', __name__)


@search_bp.route('/search', methods=['GET'])
@handle_db_errors
def search():
    """
    Searches CelestialObject by Name or Constellation, paginated.

    Args:
        q (str): The search query string.
        page (int): The page number for pagination (default is 1).
        limit (int): The number of results per page (default is 48).

    Returns:
        JSON response containing:
            - data: List of matching celestial objects.
            - total: Total number of matching results.
            - page: Current page number.
            - limit: Number of results per page.
    """
    q = escape(request.args.get('q', '').strip())
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 48))
    offset = (page - 1) * limit

    # Base query for filtering
    like_pattern = f"%{q}%"
    query = """
        SELECT *
        FROM CelestialObject
        WHERE Name LIKE %s
            OR Constellation LIKE %s
        ORDER BY Name
        LIMIT %s
        OFFSET %s
    """

    # Get total count to help React manage pagination
    count_query = """
        SELECT COUNT(*) AS total
        FROM CelestialObject
        WHERE Name LIKE %s
            OR Constellation LIKE %s
    """

    # No try/except here -- @handle_db_errors catches mysql.connector.Error
    # for us. No manual .close() either -- `with` closes the cursor and
    # connection automatically, success or failure.
    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (like_pattern, like_pattern, limit, offset))
            results = cursor.fetchall()

            cursor.execute(count_query, (like_pattern, like_pattern))
            total = cursor.fetchone()['total']

    return jsonify({
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    })
