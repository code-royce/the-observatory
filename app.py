
from flask import Flask, render_template, request
import mysql.connector
from mysql.connector import Error
from markupsafe import escape
import config

app = Flask(__name__)

def get_db_connection():
    """Return a new MySQL connection using values from config.py."""
    return mysql.connector.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        port=config.DB_PORT,
    )

@app.route('/', methods=['GET'])
def index():
    q = escape(request.args.get('q', '').strip())
    results = []
    error = None

    if q:
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            query = ("SELECT * FROM CelestialObject WHERE Name LIKE %s LIMIT 10")

            # Query based on form input. Will throw error if the q param isn't
            # used in the query.
            cursor.execute(query, (f"%{q}%",))
            results = cursor.fetchall()
        except Error as e:
            error = str(e)
        finally:
            try:
                cursor.close()
                conn.close()
            except Exception:
                pass

    return render_template('index.html', results=results, q=q, error=error)

# Not sure if we're going to use this, but maybe useful if we want to keep
# db connection open while developing locally.
# @app.teardown_appcontext
# def close_db(exception=None):
#     """Closes the database connection at the end of the request."""
#     db = g.pop('db', None)
#     if db is not None and db.is_connected():
#         db.close()
