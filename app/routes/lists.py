from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, jsonify, request
from mysql.connector import IntegrityError, errorcode

from app.horizon_calculator import julian_date, local_sidereal_time
from app.utils import get_db_connection, handle_db_errors

lists_bp = Blueprint('lists', __name__)

# app/routes/lists.py -> app/routes -> app -> repo root
SQL_DIR = Path(__file__).resolve().parents[2] / 'sql' / 'transactions'


def _load_sql(filename):
    """
    Reads one query out of sql/transactions/.

    The advanced queries live in .sql files rather than inline strings so
    they are reviewable next to the project's other SQL, and so a grader or
    teammate can find them without reading Python. The transaction itself
    can't move there -- START TRANSACTION/COMMIT are runtime statements the
    connector has to issue and roll back, not database objects like the
    procedures and triggers in the sibling folders.

    Args:
        filename (str): File name inside sql/transactions/.

    Returns:
        str: The file's contents, minus the trailing semicolon, so the same
            file can be pasted straight into a mysql client and also handed
            to cursor.execute().
    """
    return (SQL_DIR / filename).read_text(encoding='utf-8').rstrip().rstrip(';')


# Read once at import rather than per request. Both queries take named
# parameters (%(list_id)s), so cursor.execute() is passed a dict, not a tuple.
LIST_METADATA_QUERY = _load_sql('ListMetadataByCategory.sql')
LIST_VISIBILITY_QUERY = _load_sql('ListVisibilityByCategory.sql')

# Every route that hands a list back to the caller selects the same columns.
LIST_COLUMNS = """
    SELECT ListID, UserID, ListName, Latitude, Longitude, CreatedAt
    FROM ObservationList
    WHERE ListID = %s"""


@lists_bp.route('/users/<int:user_id>/lists', methods=['GET'])
@handle_db_errors
def user_lists(user_id):
    """
    Returns every ObservationList belonging to one user, newest first.

    Args:
        user_id (int): The Users.UserID whose lists to fetch, from the URL.

    Returns:
        JSON response containing:
            - data: list of the user's ObservationLists as dictionaries,
              each with an added ObjectCount.
            - total: number of lists returned.
    """
    # Chose a left join instead of an inner join so that a list without saved
    # objects can be returned. Empty lists are common since the
    # CreateDefaultObservationList trigger gives every new user an empty list.
    query = """
        SELECT ol.ListID, ol.UserID, ol.ListName, ol.Latitude, ol.Longitude,
               ol.CreatedAt, COUNT(s.ObjectID) AS ObjectCount
        FROM ObservationList ol
            LEFT JOIN SavedObject s ON s.ListID = ol.ListID
        WHERE ol.UserID = %s
        GROUP BY ol.ListID, ol.UserID, ol.ListName, ol.Latitude, ol.Longitude,
                 ol.CreatedAt
        ORDER BY ol.CreatedAt DESC, ol.ListID DESC
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(query, (user_id,))
            results = cursor.fetchall()

    return jsonify({
        "data": results,
        "total": len(results)
    })


@lists_bp.route('/lists/<int:list_id>', methods=['GET'])
@handle_db_errors
def list_detail(list_id):
    """
    Returns one ObservationList, its per-category progress summary, and a
    page of the objects saved to it.

    Args:
        list_id (int): The ObservationList.ListID to fetch, from the URL.
        page (int): The page number for the saved objects (default is 1).
        limit (int): Saved objects per page (default is 48).

    Returns:
        JSON response containing:
            - data: the ObservationList row as a dictionary.
            - summary: per-ObjectCategory progress rows, covering the whole
              list, not just this page.
            - visibility: per-ObjectCategory counts, judged from the list's
              own coordinates: OnList (saved to this list), Observable
              (bright enough to beat the local light pollution), and UpNow
              (observable and above the horizon right now). Empty when the
              list has no coordinates saved, since visibility is meaningless
              without a location.
            - objects: this page of saved objects, each joined to its
              CelestialObject row and carrying IsObserved, Notes and AddedAt.
            - total: total number of objects saved to the list.
            - page, limit: the pagination that was applied.
        A 404 if no list has that ListID.
    """
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 48))
    offset = (page - 1) * limit

    # Applied pagination to this query the same as /api/search because one list
    # can have >100k saved objects.
    # Unnamed NGC/IC rows sort to the end rather than being dropped, and
    # ObjectID breaks ties so LIMIT/OFFSET can't skip or repeat a row.
    objects_query = """
        SELECT c.ObjectID, c.Name, c.Magnitude, c.ObjectCategory,
               c.RightAscension, c.Declination, c.Constellation,
               s.IsObserved, s.Notes, s.AddedAt
        FROM SavedObject s
            JOIN CelestialObject c ON c.ObjectID = s.ObjectID
        WHERE s.ListID = %s
        ORDER BY (c.Name IS NULL), c.Name, c.ObjectID
        LIMIT %s
        OFFSET %s
    """

    count_query = """
        SELECT COUNT(*) AS total
        FROM SavedObject
        WHERE ListID = %s
    """

    with get_db_connection() as conn:
        # `total`, `summary`, and `visibility` come from separate queries and
        # can't be derived from one another -- LIST_METADATA_QUERY's HAVING
        # clause drops fully-observed categories, so its counts deliberately
        # don't sum to `total`. The response hands all three back as though
        # they describe one list, and REPEATABLE READ is what makes that true
        # by construction: every statement here reads the same snapshot.
        conn.start_transaction(isolation_level='REPEATABLE READ')

        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(LIST_COLUMNS, (list_id,))
            observation_list = cursor.fetchone()

            if observation_list is None:
                # Nothing was written, and closing the connection discards the
                # open snapshot, so there is nothing to roll back.
                return jsonify({"error": "Observation list not found"}), 404

            cursor.execute(LIST_METADATA_QUERY, {"list_id": list_id})
            summary = cursor.fetchall()

            # COUNT() returns an int, but SUM() and ROUND() return Decimals,
            # which Flask serializes as a JSON string ("90", not 90).
            # Convert so every number in the summary is actually a number to
            # the frontend.
            for row in summary:
                row['Observed'] = int(row['Observed'] or 0)
                row['CompletionRate'] = int(row['CompletionRate'] or 0)

            visibility = []
            latitude = observation_list['Latitude']
            longitude = observation_list['Longitude']

            # A list with no coordinates can't be checked against a horizon,
            # so the second query is skipped rather than fed a fake location.
            if latitude is not None and longitude is not None:
                now = datetime.now(timezone.utc)
                cursor.execute(LIST_VISIBILITY_QUERY, {
                    "list_id": list_id,
                    "lat": latitude,
                    "lon": longitude,
                    "lst": local_sidereal_time(julian_date(now), longitude),
                    "min_alt": 20,  # clears trees, buildings, refraction
                })
                visibility = cursor.fetchall()

                # Same Decimal-to-int conversion as the summary because COUNT()
                # returns an int but SUM() returns a Decimal.
                for row in visibility:
                    row['Observable'] = int(row['Observable'] or 0)
                    row['UpNow'] = int(row['UpNow'] or 0)

            cursor.execute(objects_query, (list_id, limit, offset))
            objects = cursor.fetchall()

            cursor.execute(count_query, (list_id,))
            total = cursor.fetchone()['total']

        # Read-only, so there is nothing to persist -- but the snapshot stays
        # open until the transaction ends, and __exit__ on the connection only
        # calls close(). Committing releases it explicitly.
        conn.commit()

    return jsonify({
        "data": observation_list,
        "summary": summary,
        "visibility": visibility,
        "objects": objects,
        "total": total,
        "page": page,
        "limit": limit
    })


@lists_bp.route('/lists', methods=['POST'])
@handle_db_errors
def create_list():
    """
    Creates a new, empty ObservationList. Objects get added afterwards from
    the search results page, so nothing is inserted into SavedObject here.

    Expects a JSON body containing:
        - user_id: int (FK to Users), required
        - list_name: str, optional. Blank or missing is left to the
          TrimObservationListName trigger, which names it for the user.
        - latitude: float, optional
        - longitude: float, optional

    Returns:
        JSON response containing the newly created list as a dictionary,
        with a 201 status code. A 400 if the body is invalid or user_id
        matches no user, or a 409 if that user already has a list by that
        name.
    """
    body = request.get_json(silent=True) or {}

    user_id = body.get('user_id')
    list_name = body.get('list_name')
    latitude = body.get('latitude')
    longitude = body.get('longitude')

    errors = []
    if user_id is None:
        errors.append("user_id is required")
    else:
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            errors.append("user_id must be an integer")

    # No check on list_name: TrimObservationListName trims it, and names a
    # blank one 'Untitled Observation List'. Rejecting it here would make that
    # branch of the trigger unreachable through the API.

    # Only convert Latitude and Longitude if they're supplied because they're
    # both nullable on ObservationList. Their numerical range isn't checked so
    # that the constraints in sql/constraints/ObservationListCoordinateConstraints.sql
    # can apply.
    if latitude is not None:
        try:
            latitude = float(latitude)
        except (TypeError, ValueError):
            errors.append("latitude must be a number")
    if longitude is not None:
        try:
            longitude = float(longitude)
        except (TypeError, ValueError):
            errors.append("longitude must be a number")

    if errors:
        return jsonify({"errors": errors}), 400

    insert_query = """
        INSERT INTO ObservationList (UserID, Latitude, Longitude, ListName)
        VALUES (%s, %s, %s, %s)
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            # @handle_db_errors turns any mysql.connector.Error into a 500,
            # which is right for a genuinely broken query but wrong for these
            # two: both are ordinary user mistakes the frontend should be able
            # to show. Caught here rather than in app/utils.py because that
            # decorator is shared with everyone else's routes.
            try:
                cursor.execute(
                    insert_query, (user_id, latitude, longitude, list_name)
                )
            except IntegrityError as e:
                if e.errno == errorcode.ER_DUP_ENTRY:
                    sent = str(list_name).strip() if list_name else ''
                    return jsonify({"errors": [
                        f"This user already has a list named '{sent}'."
                        if sent else
                        "This user already has an untitled list. Name this one to tell them apart."
                    ]}), 409
                if e.errno == errorcode.ER_NO_REFERENCED_ROW_2:
                    return jsonify({"errors": [
                        f"No user exists with user_id {user_id}."
                    ]}), 400
                raise

            new_id = cursor.lastrowid
            conn.commit()

            # Read the row back rather than echoing the request: CreatedAt is
            # database-generated, and the TrimObservationListName trigger may
            # have rewritten ListName on the way in.
            cursor.execute(LIST_COLUMNS, (new_id,))
            new_list = cursor.fetchone()

    return jsonify({"data": new_list}), 201


@lists_bp.route('/lists/<int:list_id>', methods=['PATCH'])
@handle_db_errors
def update_list(list_id):
    """
    Updates an existing ObservationList. Any field left out of the body is
    left unchanged, so the frontend can rename a list without resending its
    coordinates.

    Args:
        list_id (int): The ObservationList.ListID to update, from the URL.

    Expects a JSON body containing any of:
        - list_name: str
        - latitude: float
        - longitude: float

    Returns:
        JSON response containing the updated list as a dictionary. A 400 if
        the body is invalid or empty, a 404 if no list has that ListID, or a
        409 if the new name collides with another of that user's lists.
    """
    body = request.get_json(silent=True) or {}

    errors = []

    # Build the SET clause from whichever fields were sent, so renaming a list
    # doesn't mean resending its coordinates. The column names are string
    # literals written here, never anything from the request body, so this
    # stays safe -- only the values are parameterized.
    assignments = []
    values = []
    list_name = body.get('list_name')

    if 'list_name' in body:
        if list_name and str(list_name).strip():
            assignments.append("ListName = %s")
            values.append(list_name)
        else:
            errors.append("list_name cannot be empty")

    if 'latitude' in body:
        try:
            latitude = float(body['latitude'])
            assignments.append("Latitude = %s")
            values.append(latitude)
        except (TypeError, ValueError):
            errors.append("latitude must be a number")

    if 'longitude' in body:
        try:
            longitude = float(body['longitude'])
            assignments.append("Longitude = %s")
            values.append(longitude)
        except (TypeError, ValueError):
            errors.append("longitude must be a number")

    # Only complain about an empty body when nothing else went wrong --
    # otherwise a single bad latitude reports two confusing errors at once.
    if not assignments and not errors:
        errors.append(
            "Provide at least one of list_name, latitude, or longitude."
        )

    if errors:
        return jsonify({"errors": errors}), 400

    update_query = f"""
        UPDATE ObservationList
        SET {", ".join(assignments)}
        WHERE ListID = %s
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            # Check existence first. A bare UPDATE can't tell "no such list"
            # apart from "the values sent matched what was already there",
            # since both report zero affected rows.
            cursor.execute(LIST_COLUMNS, (list_id,))
            if cursor.fetchone() is None:
                return jsonify({"error": "Observation list not found"}), 404

            try:
                cursor.execute(update_query, (*values, list_id))
            except IntegrityError as e:
                if e.errno == errorcode.ER_DUP_ENTRY:
                    return jsonify({"errors": [
                        f"This user already has a list named '{list_name}'."
                    ]}), 409
                raise

            conn.commit()

            cursor.execute(LIST_COLUMNS, (list_id,))
            updated_list = cursor.fetchone()

    return jsonify({"data": updated_list})


@lists_bp.route('/lists/<int:list_id>/objects', methods=['POST'])
@handle_db_errors
def add_objects(list_id):
    """
    Saves one or more CelestialObjects to an ObservationList.

    Takes a list of IDs so that adding several objects costs one request
    rather than one per object. Which objects end up in that list is the
    frontend's decision -- they might come from one search, several
    searches, or individual clicks. Adding a single object means sending a
    one-element list.

    Args:
        list_id (int): The ObservationList.ListID to add to, from the URL.

    Objects arrive unobserved and unannotated -- IsObserved defaults to FALSE
    and Notes to NULL. Marking one off is a PATCH to the object afterwards.

    Expects a JSON body containing:
        - object_ids: list[int] (FKs to CelestialObject), required.

    Returns:
        JSON response reporting how many rows were added and how many were
        already on the list, with a 201 status code. A 400 if the body is
        invalid or an ObjectID matches no celestial object, or a 404 if no
        list has that ListID.
    """
    body = request.get_json(silent=True) or {}

    object_ids = body.get('object_ids')

    errors = []
    if not isinstance(object_ids, list) or not object_ids:
        errors.append("object_ids is required and must be a non-empty list")
        object_ids = []

    clean_ids = []
    for object_id in object_ids:
        try:
            clean_ids.append(int(object_id))
        except (TypeError, ValueError):
            errors.append(f"object_ids must all be integers; got {object_id!r}")

    if errors:
        return jsonify({"errors": errors}), 400

    # One multi-row INSERT rather than one statement per object.
    placeholders = ", ".join(["(%s, %s)"] * len(clean_ids))
    values = []
    for object_id in clean_ids:
        values.extend([list_id, object_id])

    # SavedObject's primary key is (ListID, ObjectID), so re-adding an object
    # is a duplicate-key error. Re-adding is ordinary user behavior though.
    insert_query = f"""
        INSERT INTO SavedObject (ListID, ObjectID)
        VALUES {placeholders}
        ON DUPLICATE KEY UPDATE ObjectID = ObjectID
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(LIST_COLUMNS, (list_id,))
            if cursor.fetchone() is None:
                return jsonify({"error": "Observation list not found"}), 404

            cursor.execute(insert_query, values)

            # With ON DUPLICATE KEY UPDATE, MySQL counts 1 for each row it
            # inserts and 0 for each row whose no-op update changed nothing,
            # so rowcount is exactly the number of genuinely new rows.
            added = cursor.rowcount
            conn.commit()

    return jsonify({"data": {
        "list_id": list_id,
        "requested": len(clean_ids),
        "added": added,
        "skipped": len(clean_ids) - added,
    }}), 201


@lists_bp.route('/lists/<int:list_id>', methods=['DELETE'])
@handle_db_errors
def delete_list(list_id):
    """
    Deletes an ObservationList and everything saved to it.

    Args:
        list_id (int): The ObservationList.ListID to delete, from the URL.

    Returns:
        JSON response naming the deleted list and how many saved objects
        went with it. A 404 if no list has that ListID.
    """
    count_query = """
        SELECT COUNT(*) AS total
        FROM SavedObject
        WHERE ListID = %s
    """

    delete_query = """
        DELETE FROM ObservationList
        WHERE ListID = %s
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(LIST_COLUMNS, (list_id,))
            observation_list = cursor.fetchone()

            if observation_list is None:
                return jsonify({"error": "Observation list not found"}), 404

            # Counted before the delete, not after. SavedObject's foreign key
            # is ON DELETE CASCADE, so those rows go with the list on their
            # own and there's nothing left to count once it's gone. Reporting
            # the number back is the only visible sign the cascade ran.
            cursor.execute(count_query, (list_id,))
            objects_removed = cursor.fetchone()['total']

            cursor.execute(delete_query, (list_id,))
            conn.commit()

    return jsonify({"data": {
        "list_id": list_id,
        "list_name": observation_list['ListName'],
        "objects_removed": objects_removed,
    }})


@lists_bp.route(
    '/lists/<int:list_id>/objects/<int:object_id>', methods=['DELETE']
)
@handle_db_errors
def remove_object(list_id, object_id):
    """
    Removes one CelestialObject from an ObservationList. Deletes only the
    SavedObject row -- the list and the celestial object both survive.

    Args:
        list_id (int): The ObservationList.ListID to remove from, from the
            URL.
        object_id (int): The CelestialObject.ObjectID to remove, from the
            URL.

    Returns:
        JSON response confirming which object was removed from which list.
        A 404 if no list has that ListID, or if that object isn't saved to
        it.
    """
    delete_query = """
        DELETE FROM SavedObject
        WHERE ListID = %s AND ObjectID = %s
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(LIST_COLUMNS, (list_id,))
            if cursor.fetchone() is None:
                return jsonify({"error": "Observation list not found"}), 404

            cursor.execute(delete_query, (list_id, object_id))

            # At most one row can match, since (ListID, ObjectID) is
            # SavedObject's primary key.
            if cursor.rowcount == 0:
                return jsonify({
                    "error": "That object is not saved to this list"
                }), 404

            conn.commit()

    # Returns a body rather than a bare 204: the frontend's flaskFetch helper
    # always calls response.json(), which throws on an empty response.
    return jsonify({"data": {
        "list_id": list_id,
        "object_id": object_id,
    }})


@lists_bp.route(
    '/lists/<int:list_id>/objects/<int:object_id>', methods=['PATCH']
)
@handle_db_errors
def update_saved_object(list_id, object_id):
    """
    Marks one CelestialObject saved to an ObservationList as observed, or
    annotates it, or both. Any field left out of the body is left unchanged.

    Args:
        list_id (int): The ObservationList.ListID the object is saved to,
            from the URL.
        object_id (int): The CelestialObject.ObjectID to update, from the
            URL.

    Expects a JSON body containing any of:
        - is_observed: bool
        - notes: str or null, <=250 characters

    Returns:
        JSON response containing the updated SavedObject row. A 400 if the
        body is invalid or empty, or a 404 if no list has that ListID or that
        object isn't saved to it.
    """
    body = request.get_json(silent=True) or {}

    errors = []

    # Same partial-update shape as update_list: the column names are literals
    # written here, never taken from the body, so only values are parameterized.
    assignments = []
    values = []

    if 'is_observed' in body:
        is_observed = body.get('is_observed')
        if not isinstance(is_observed, bool):
            errors.append("is_observed must be true or false")
        else:
            assignments.append("IsObserved = %s")
            values.append(is_observed)

    if 'notes' in body:
        notes = body.get('notes')
        # Null clears the note; the column is nullable.
        if notes is not None and (
            not isinstance(notes, str) or len(notes) > 250
        ):
            errors.append("notes must be a string of 250 characters or fewer")
        else:
            assignments.append("Notes = %s")
            values.append(notes)

    if not assignments and not errors:
        errors.append("Send is_observed, notes, or both")

    if errors:
        return jsonify({"errors": errors}), 400

    update_query = f"""
        UPDATE SavedObject
        SET {", ".join(assignments)}
        WHERE ListID = %s AND ObjectID = %s
    """

    read_back = """
        SELECT ListID, ObjectID, IsObserved, Notes, AddedAt
        FROM SavedObject
        WHERE ListID = %s AND ObjectID = %s
    """

    with get_db_connection() as conn:
        with conn.cursor(dictionary=True) as cursor:
            cursor.execute(LIST_COLUMNS, (list_id,))
            if cursor.fetchone() is None:
                return jsonify({"error": "Observation list not found"}), 404

            cursor.execute(update_query, (*values, list_id, object_id))

            # rowcount is 0 both when no such row exists and when the update
            # changed nothing, so the row is looked up rather than inferred.
            cursor.execute(read_back, (list_id, object_id))
            updated = cursor.fetchone()

            if updated is None:
                return jsonify({
                    "error": "That object is not saved to this list"
                }), 404

            conn.commit()

    return jsonify({"data": updated})
