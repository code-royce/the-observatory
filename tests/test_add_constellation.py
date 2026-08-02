"""
test_add_constellation.py

Exercises the AddConstellationToList stored procedure against the real
database. Creates its own ObservationList, runs every case against it, then
deletes it again -- existing data is never modified, so it is safe to run as
often as you like.

Run from the repo root with the virtual environment active:
    python tests/test_add_constellation.py

The procedure must already be installed on Cloud SQL. See
sql/stored_procedures/AddConstellationToList.sql.
"""

import sys
from pathlib import Path

# The repo root, so `app` and `config` resolve when this runs from tests/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mysql.connector import DatabaseError, errorcode

from app.utils import get_db_connection

# The coordinates doc/Database Design.pdf used for Query 1, so VisibleCount
# here is directly comparable to its published output (Ori | 5 | 8 | 63%).
CHAMPAIGN_LAT = 40.1164
CHAMPAIGN_LON = -88.2434

CONSTELLATION = 'Orion'
SCRATCH_LIST_NAME = 'constellation test (safe to delete)'

# MySQL procedures have no default parameter values, so this is passed on
# every call. 3 is what the design doc published its figures against.
MAX_MAGNITUDE = 3

# Every check appends its result here so the run ends with one verdict
# instead of a wall of output you have to read carefully.
failures = []


def call_procedure(cursor, list_id, constellation):
    """
    Calls AddConstellationToList and returns its row of counts.

    Args:
        cursor: An open dictionary cursor.
        list_id (int): The ObservationList.ListID to add to.
        constellation (str): The constellation name.

    Returns:
        dict: StarCount, VisibleCount, Added, and AlreadyOnList.
    """
    cursor.callproc(
        "AddConstellationToList",
        (list_id, constellation, MAX_MAGNITUDE)
    )

    # A procedure can emit several result sets, so its rows arrive through
    # stored_results() rather than on the cursor. Ours emits one.
    counts = {}
    for output in cursor.stored_results():
        counts = output.fetchone()

    return counts


def check(label, actual, expected):
    """
    Compares one value and records the outcome.

    Args:
        label (str): What is being checked, for the printed line.
        actual: The value the database produced.
        expected: The value it should have produced.

    Returns:
        None. Prints a line and appends to `failures` on a mismatch.
    """
    if actual == expected:
        print(f"    PASS  {label}: {actual}")
    else:
        print(f"    FAIL  {label}: got {actual}, expected {expected}")
        failures.append(f"{label}: got {actual}, expected {expected}")


conn = get_db_connection()
cursor = conn.cursor(dictionary=True)
scratch_list_id = None

try:
    # ---------------------------------------------------------------
    # Reference values, read-only
    # ---------------------------------------------------------------
    print("\nReference")

    cursor.execute(
        """
        SELECT COUNT(*) AS StarCount,
               SUM(Magnitude <= 6) AS AtFallback
        FROM CelestialObject
        WHERE Constellation = %s AND Magnitude < %s
        """,
        (CONSTELLATION, MAX_MAGNITUDE)
    )
    reference = cursor.fetchone()
    star_count = reference['StarCount']

    print(f"    {CONSTELLATION} has {star_count} stars brighter than mag 3")
    print(f"    {reference['AtFallback']} of them are visible at the "
          f"fallback limiting magnitude of 6")

    # The procedure's WHERE already restricts to Magnitude < 3, so every one
    # of those rows also satisfies Magnitude <= 6. If these disagree, the
    # fallback expectation below is wrong and nothing else here means much.
    check("all bright stars visible at fallback",
          int(reference['AtFallback']), star_count)

    cursor.execute(
        "SELECT ListID, ListName, Latitude, Longitude "
        "FROM ObservationList WHERE ListID IN (1, 2)"
    )
    for row in cursor.fetchall():
        print(f"    ListID {row['ListID']}: lat={row['Latitude']}, "
              f"lon={row['Longitude']}  ({row['ListName']})")

    # ---------------------------------------------------------------
    # A scratch list of our own, with no coordinates yet
    # ---------------------------------------------------------------
    cursor.execute("SELECT UserID FROM Users ORDER BY UserID LIMIT 1")
    user_id = cursor.fetchone()['UserID']

    # A previous crashed run could have left one behind, and
    # (UserID, ListName) is unique.
    cursor.execute(
        "DELETE FROM ObservationList WHERE UserID = %s AND ListName = %s",
        (user_id, SCRATCH_LIST_NAME)
    )

    cursor.execute(
        "INSERT INTO ObservationList (UserID, ListName) VALUES (%s, %s)",
        (user_id, SCRATCH_LIST_NAME)
    )
    scratch_list_id = cursor.lastrowid
    conn.commit()

    print(f"\nCreated scratch ListID {scratch_list_id} for UserID {user_id}")

    # ---------------------------------------------------------------
    # 1. No coordinates -- the light pollution lookup finds nothing and
    #    falls back to limiting magnitude 6, so every bright star counts.
    # ---------------------------------------------------------------
    print("\n1. List with NULL coordinates (expect the fallback)")

    counts = call_procedure(cursor, scratch_list_id, CONSTELLATION)
    conn.commit()

    check("StarCount", counts['StarCount'], star_count)
    check("VisibleCount", counts['VisibleCount'], star_count)
    check("Added", counts['Added'], star_count)
    check("AlreadyOnList", counts['AlreadyOnList'], 0)

    # ---------------------------------------------------------------
    # 2. Same list moved to Champaign. The design doc's Query 1 reports
    #    5 of Orion's 8 visible from there, so this is a direct
    #    cross-check that the rewritten query agrees with the original.
    # ---------------------------------------------------------------
    print("\n2. Same list at Champaign (expect fewer visible)")

    cursor.execute("DELETE FROM SavedObject WHERE ListID = %s",
                   (scratch_list_id,))
    cursor.execute(
        "UPDATE ObservationList SET Latitude = %s, Longitude = %s "
        "WHERE ListID = %s",
        (CHAMPAIGN_LAT, CHAMPAIGN_LON, scratch_list_id)
    )
    conn.commit()

    counts = call_procedure(cursor, scratch_list_id, CONSTELLATION)
    conn.commit()

    print(f"    VisibleCount at Champaign: {counts['VisibleCount']} "
          f"of {counts['StarCount']}")
    check("Added", counts['Added'], star_count)

    # The real signal: a location has to change the answer. If this matches
    # the fallback, the procedure is ignoring the list's coordinates.
    if counts['VisibleCount'] == star_count:
        print("    FAIL  VisibleCount is unchanged from the NULL case -- "
              "the list's coordinates are not reaching the query")
        failures.append("VisibleCount ignores the list's coordinates")
    else:
        print("    PASS  VisibleCount differs from the fallback")

    # ---------------------------------------------------------------
    # 3. Partial overlap. This is the only case that proves the NOT EXISTS
    #    correlation works: on an empty list every row passes the filter,
    #    and on a full list none do, so both extremes look identical
    #    whether or not the correlation is correct.
    # ---------------------------------------------------------------
    print("\n3. List already holding one member (the discriminating case)")

    cursor.execute(
        """
        DELETE FROM SavedObject
        WHERE ListID = %s
            AND ObjectID NOT IN (
                SELECT ObjectID FROM (
                    SELECT ObjectID FROM CelestialObject
                    WHERE Constellation = %s AND Magnitude < %s
                    ORDER BY ObjectID LIMIT 1
                ) AS KeepOne
            )
        """,
        (scratch_list_id, CONSTELLATION, MAX_MAGNITUDE)
    )
    conn.commit()

    counts = call_procedure(cursor, scratch_list_id, CONSTELLATION)
    conn.commit()

    check("Added", counts['Added'], star_count - 1)
    check("AlreadyOnList", counts['AlreadyOnList'], 1)

    # ---------------------------------------------------------------
    # 4. Everything already saved -- adding again is a no-op, not an error.
    # ---------------------------------------------------------------
    print("\n4. Adding the same constellation twice")

    counts = call_procedure(cursor, scratch_list_id, CONSTELLATION)
    conn.commit()

    check("Added", counts['Added'], 0)
    check("AlreadyOnList", counts['AlreadyOnList'], star_count)

    # ---------------------------------------------------------------
    # 5. Errors the procedure and the schema are supposed to raise.
    # ---------------------------------------------------------------
    print("\n5. Rejections")

    try:
        call_procedure(cursor, scratch_list_id, 'Xyz')
        print("    FAIL  unknown constellation: no error raised")
        failures.append("unknown constellation was accepted")
    except DatabaseError as e:
        check("unknown constellation raises SIGNAL",
              e.errno, errorcode.ER_SIGNAL_EXCEPTION)

    try:
        call_procedure(cursor, 999999999, CONSTELLATION)
        print("    FAIL  nonexistent list: no error raised")
        failures.append("nonexistent list was accepted")
    except DatabaseError as e:
        check("nonexistent list rejected by foreign key",
              e.errno, errorcode.ER_NO_REFERENCED_ROW_2)

finally:
    # SavedObject's foreign key is ON DELETE CASCADE, so the saved stars go
    # with the list. Runs even if a check above raised, so a failed run
    # doesn't leave rows behind.
    if scratch_list_id is not None:
        conn.rollback()
        cursor.execute("DELETE FROM ObservationList WHERE ListID = %s",
                       (scratch_list_id,))
        conn.commit()
        print(f"\nRemoved scratch ListID {scratch_list_id}")

    cursor.close()
    conn.close()

print()
if failures:
    print(f"{len(failures)} check(s) failed:")
    for failure in failures:
        print(f"  - {failure}")
    sys.exit(1)

print("All checks passed.")
