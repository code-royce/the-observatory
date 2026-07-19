import os

from app import create_app

app = create_app()

# --- Disabled routes kept for team review ---------------------------------
# Per the headless-API guide ("How do I setup flask to act strictly as a
# headless API_.pdf", repo root), these two routes were left out of the
# active blueprint (app/routes/search.py): /api/test was just boilerplate
# example code, and / mixed HTML rendering into what should be a JSON-only
# API. Kept here, disabled, until the team confirms they can be deleted.

# TEMPLATE ROUTE GUIDANCE
# @app.route('/api/test', methods=['GET'])
# def test_data():
#     """
#     Example API route to use as a starting point.
#
#     When using as boilerplate:
#         1. Make sure everything after /api/ is unique.
#         2. Always return JSON. In other words, wrap data returned from
#            MySQL in a call to jsonify.
#         3. Escape user-entered values for security. e.g. escape('user
#            input')
#
#     Returns:
#         JSON response containing a static greeting message.
#     """
#     return jsonify({"message": "Hello test data!"})

# HTML route for testing queries
# @app.route('/', methods=['GET'])
# def index():
#     """
#     Renders an HTML page with search results, for manual query testing
#     before the React frontend existed.
#
#     Args:
#         q (str): The search query string.
#
#     Returns:
#         Rendered index.html template with results, q, and error context.
#     """
#     q = escape(request.args.get('q', '').strip())
#     results = []
#     error = None
#
#     if q:
#         try:
#             conn = get_db_connection()
#             cursor = conn.cursor(dictionary=True)
#             query = """
#                 (SELECT *
#                  FROM CelestialObject
#                  WHERE Name LIKE %s
#                  LIMIT 5)
#
#                 UNION
#
#                 (SELECT *
#                  FROM CelestialObject
#                  WHERE Constellation LIKE %s
#                  LIMIT 5)
#             """
#
#             # Query based on form input. Will throw error if the q param
#             # isn't used in the query.
#             cursor.execute(query, (f"%{q}%", f"%{q}%"))
#             results = cursor.fetchall()
#         except Error as e:
#             error = str(e)
#         finally:
#             try:
#                 cursor.close()
#                 conn.close()
#             except Exception:
#                 pass
#
#     return render_template('index.html', results=results, q=q, error=error)
# ---------------------------------------------------------------------------

# Not sure if we're going to use this, but maybe useful if we want to keep
# db connection open while developing locally.
# @app.teardown_appcontext
# def close_db(exception=None):
#     """Closes the database connection at the end of the request."""
#     db = g.pop('db', None)
#     if db is not None and db.is_connected():
#         db.close()

if __name__ == '__main__':
    # Cloud Run populates the PORT environment variable automatically
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
