from flask import Blueprint, jsonify, request
from mysql.connector import IntegrityError, errorcode

from app.utils import get_db_connection, handle_db_errors

users_bp = Blueprint('users', __name__)

@users_bp.route('/users', methods=['POST'])
@handle_db_errors

def create_user():
    """
    Creates a new user.

    Expects a JSON object containing only:
        - name: string, required
        - email: string, required

    Returns:
        JSON response containing:
            - message: success message
            - user_id: ID of the newly created user
    """
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "JSON body must be an object containing only 'name' and 'email'."}), 400

    if set(data.keys()) != {"name", "email"}:
        return jsonify({"error": "JSON body must contain only 'name' and 'email'."}), 400

    name = data.get('name')
    email = data.get('email')

    if not isinstance(name, str) or not name.strip() or not isinstance(email, str) or not email.strip():
        return jsonify({"error": "Name and Email are required fields."}), 400

    # Insert the new user into the database
    insert_query = """
        INSERT INTO Users (Name, Email)
        VALUES (%s, %s)
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            try:
                cursor.execute(insert_query, (name, email))
            except IntegrityError as e:
                if e.errno == errorcode.ER_DUP_ENTRY:
                    return jsonify({"error": "Email already exists."}), 409
                raise
            user_id = cursor.lastrowid
            conn.commit()

    return jsonify({
        "message": "User created successfully.",
        "user_id": user_id
    }), 201