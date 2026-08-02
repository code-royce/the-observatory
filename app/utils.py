from functools import wraps

from flask import jsonify
from mysql.connector import Error
import mysql.connector
import config


def get_db_connection():
    """
    Return a new MySQL connection using values from config.py.

    Returns:
        mysql.connector.connection.MySQLConnection: An open connection to
            the database configured in config.py.
    """
    return mysql.connector.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        port=config.DB_PORT,
    )


# A violated CHECK constraint is the user typing something out of range, not
# the server breaking, so it comes back as a 400 the frontend can show.
ER_CHECK_CONSTRAINT_VIOLATED = 3819


def handle_db_errors(f):
    """
    Wrap a route so mysql.connector errors always come back as JSON, not a
    stack trace. Use this on new routes instead of repeating a
    try/except Error block in every one.

    Args:
        f (Callable): The route function to wrap.

    Returns:
        Callable: The wrapped route function. Behaves the same as f, except
            a mysql.connector.Error raised inside it is caught and turned
            into JSON -- a 400 for a violated CHECK constraint, a 500 for
            anything else -- instead of propagating.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Error as e:
            if e.errno == ER_CHECK_CONSTRAINT_VIOLATED:
                return jsonify({"errors": [str(e)]}), 400
            return jsonify({"error": str(e)}), 500
    return wrapper