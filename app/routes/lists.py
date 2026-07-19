from flask import Blueprint

# Registered under /api/lists in app/__init__.py. Intended to eventually
# hold a route like /api/lists/<user_id> that returns all of a user's
# Observation Lists, for the "My Log" page. No routes yet -- stub for
# whoever picks up that work.
lists_bp = Blueprint('lists', __name__)
