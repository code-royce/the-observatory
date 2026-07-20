from flask import Blueprint, jsonify, request
from markupsafe import escape

from app.utils import get_db_connection, handle_db_errors

search_bp = Blueprint('search', __name__)

# CelestialObject.ObjectCategory stores abbreviated RNGC codes, not the
# friendly names the frontend/API use. Multiple codes can mean the same
# thing (e.g. "SS" and "SS?" are both a Star). Two rows in the dataset carry
# codes outside this scheme ("PD" and a literal "type") -- they're treated
# as unmapped/malformed and left untranslated rather than guessed at.
CATEGORY_CODES = {
    "Star": ["Star", "SS", "SS?"],
    "Double Star": ["DS", "DS?"],
    "Triple Star": ["TS"],
    "Galaxy": ["Gx"],
    "Unidentified": ["U", "?", "-"],
    "Reflection Nebula": ["Nb"],
    "Open Cluster": ["OC", "C+N"],
    "Globular Cluster": ["Gb"],
    "Planetary Nebula": ["Pl"],
    "Asterism": ["Ast"],
    "Knot": ["Kt"],
}

# Build the reverse lookup: raw code -> friendly name.
CODE_TO_CATEGORY = {}
for name, codes in CATEGORY_CODES.items():
    for code in codes:
        CODE_TO_CATEGORY[code] = name


@search_bp.route('/search', methods=['GET'])
@handle_db_errors
def search():
    """
    Searches CelestialObject by Name or Constellation, paginated.

    Args:
        q (str): The search query string.
        page (int): The page number for pagination (default is 1).
        limit (int): The number of results per page (default is 48).
        types (list[str]): Object categories to filter by (repeated query
            param, e.g. ?types=Star&types=Galaxy). Omit to include every
            category.

    Returns:
        JSON response containing:
            - data: List of matching celestial objects.
            - total: Total number of matching results.
            - page: Current page number.
            - limit: Number of results per page.
    """
    q = escape(request.args.get('q', '').strip())
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 48))
    offset = (page - 1) * limit
    types = request.args.getlist('types')

    # The frontend sends friendly category names (e.g. "Galaxy"), but the
    # database stores raw RNGC codes (e.g. "Gx") -- translate before
    # querying. A friendly name can map to several raw codes.
    raw_codes = []
    for friendly_name in types:
        raw_codes.extend(CATEGORY_CODES.get(friendly_name, []))

    # Base query for filtering
    like_pattern = f"%{q}%"

    # Only add the category filter when types were actually selected --
    # an empty IN () clause would match nothing instead of everything.
    type_filter = ""
    if raw_codes:
        placeholders = ", ".join(["%s"] * len(raw_codes))
        type_filter = f" AND ObjectCategory IN ({placeholders})"

    query = f"""
        SELECT *
        FROM CelestialObject
        WHERE (Name LIKE %s OR Constellation LIKE %s)
            {type_filter}
        ORDER BY Name
        LIMIT %s
        OFFSET %s
    """

    # Get total count to help React manage pagination
    count_query = f"""
        SELECT COUNT(*) AS total
        FROM CelestialObject
        WHERE (Name LIKE %s OR Constellation LIKE %s)
            {type_filter}
    """

    # No try/except here -- @handle_db_errors catches mysql.connector.Error
    # for us. No manual .close() either -- `with` closes the cursor and
    # connection automatically, success or failure.
    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(
                query, (like_pattern, like_pattern, *raw_codes, limit, offset)
            )
            results = cursor.fetchall()

            cursor.execute(
                count_query, (like_pattern, like_pattern, *raw_codes)
            )
            total = cursor.fetchone()['total']

    # Translate each row's raw ObjectCategory code back into the friendly
    # name the frontend expects. Codes with no known mapping (bad/unmapped
    # data) are left as-is.
    for row in results:
        row['ObjectCategory'] = CODE_TO_CATEGORY.get(
            row['ObjectCategory'], row['ObjectCategory']
        )

    return jsonify({
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    })
