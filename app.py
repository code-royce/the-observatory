import os
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from markupsafe import escape
import config

app = Flask(__name__)

# Allow requests from Github pages and local dev
CORS(app, origins=[
    "https://cs411-alawini.github.io/su26-cs411-team018-theSQLInjectors",
    "http://localhost:5173"
])

def get_db_connection():
    """Return a new MySQL connection using values from config.py."""
    return mysql.connector.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=config.DB_NAME,
        port=config.DB_PORT,
    )

@app.route('/api/search', methods=['GET'])
def search():
    """
    Searches CelestialObject by Name or Constellation, paginated.

    Args:
        q (str): The search query string.
        page (int): The page number for pagination (default is 1).
        limit (int): The number of results per page (default is 20).

    Returns:
        JSON response containing:
            - data: List of matching celestial objects.
            - total: Total number of matching results.
            - page: Current page number.
            - limit: Number of results per page.
    """
    q = escape(request.args.get('q', '').strip())
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
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

    # Error handling will retun JSON and 500 status code
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(query, (like_pattern, like_pattern, limit, offset))
        results = cursor.fetchall()

        cursor.execute(count_query, (like_pattern, like_pattern))
        total = cursor.fetchone()['total']
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
            conn.close()
        except Exception:
            pass

    return jsonify({
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    })

@app.route('/api/test', methods=['GET'])
def test_data():
    '''
    Example API route to use as a starting point.
    When using as boilerplate:
        1. Make sure everything after /api/ is unique.
        2. Always return JSON. In other words, wrap data returned from MySQL
           in a call to jsonify.
        3. Escape user-entered values for security. e.g. escape('user input')
    '''
    return jsonify({"message": "Hello test data!"})

if __name__ == '__main__':
     # Cloud Run populates the PORT environment variable automatically
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)

# HTML route for testing queries
@app.route('/', methods=['GET'])
def index():
    q = escape(request.args.get('q', '').strip())
    results = []
    error = None

    if q:
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            query = """
                (SELECT *
                 FROM CelestialObject
                 WHERE Name LIKE %s
                 LIMIT 5)

                UNION

                (SELECT *
                 FROM CelestialObject
                 WHERE Constellation LIKE %s
                 LIMIT 5)
            """

            # Query based on form input. Will throw error if the q param isn't
            # used in the query.
            cursor.execute(query, (f"%{q}%", f"%{q}%"))
            results = cursor.fetchall()
        except Error as e:
            error = str(e)
        finally:
            try:
                cursor.close()
                conn.close()
            except Exception:
                pass

    # Eventually, this will be replaced with returning JSON for the React app.
    return render_template('index.html', results=results, q=q, error=error)

# Not sure if we're going to use this, but maybe useful if we want to keep
# db connection open while developing locally.
# @app.teardown_appcontext
# def close_db(exception=None):
#     """Closes the database connection at the end of the request."""
#     db = g.pop('db', None)
#     if db is not None and db.is_connected():
#         db.close()
