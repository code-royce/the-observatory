from flask import Blueprint, jsonify, request
from markupsafe import escape

from app.utils import get_db_connection, handle_db_errors

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/reports', methods=['GET'])
@handle_db_errors
def reports():
    """
    Returns all tuples form the CommunityReports table
    """
    # Create a querry to get the reports to appear in the community reports
    query_reports = f"""SELECT *
                        FROM CommunityReport"""

    # Use the above to querry the gcp database
    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query_reports)
            reports_results = cursor.fetchall()


    return jsonify(reports_results)
