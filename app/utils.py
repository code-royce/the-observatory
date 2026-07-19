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
            into a JSON 500 response instead of propagating.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Error as e:
            return jsonify({"error": str(e)}), 500
    return wrapper