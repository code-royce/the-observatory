from flask import Flask, jsonify
from flask_cors import CORS


def create_app():
    """
    Build and configure the Flask application.

    Returns:
        Flask: The configured app, with CORS enabled, error handlers
            registered, and blueprints mounted under /api.
    """
    app = Flask(__name__)

    # Allow requests from Github pages and local dev
    CORS(app, origins=[
        "https://cs411-alawini.github.io/su26-cs411-team018-theSQLInjectors",
        "http://localhost:5173"
    ])

    @app.errorhandler(404)
    def not_found(error):
        """
        Global handler so an unmatched route returns JSON, not HTML.

        Args:
            error (HTTPException): The 404 error raised by Flask.

        Returns:
            JSON response with an error message and a 404 status code.
        """
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_server_error(error):
        """
        Global handler so an unexpected server error returns JSON, not
        HTML.

        Args:
            error (Exception): The unhandled exception that reached Flask.

        Returns:
            JSON response with an error message and a 500 status code.
        """
        return jsonify({"error": "An internal server error occurred"}), 500

    from app.routes.search import search_bp
    from app.routes.lists import lists_bp
    from app.routes.visibility import visibility_bp
    from app.routes.reports import reports_bp
    from app.routes.users import users_bp

    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(lists_bp, url_prefix='/api')
    app.register_blueprint(visibility_bp, url_prefix='/api')
    app.register_blueprint(reports_bp, url_prefix='/api')
    app.register_blueprint(users_bp, url_prefix='')

    return app
