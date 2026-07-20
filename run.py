import os

from app import create_app

app = create_app()

# --- Disabled routes kept for team review ---------------------------------
# Per the headless-API guide ("How do I setup flask to act strictly as a
# headless API_.pdf", repo root), the /api/test route was left out of the active
# blueprint (app/routes/search.py) because it was just example code.
# It's kept here and disabled until the team confirms it can be deleted.

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
