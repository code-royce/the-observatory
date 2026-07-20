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

    return
