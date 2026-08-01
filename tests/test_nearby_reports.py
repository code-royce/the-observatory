"""
test_nearby_reports.py

Exercises GET /api/reports/nearby -- advanced query 3 from
doc/Database Design.pdf -- against the real database. Read-only: no rows are
created, changed, or deleted, so it is safe to run as often as you like.

Runs Flask's test client rather than HTTP, so the backend does not need to be
running. A working config.py does.

Run from the repo root with the virtual environment active:
    python tests/test_nearby_reports.py
"""

import sys
from pathlib import Path

# The repo root, so `app` and `config` resolve when this runs from tests/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.utils import get_db_connection

# The coordinates doc/Database Design.pdf used for Query 3.
CHICAGO_LAT = 41.8832
CHICAGO_LON = -87.6324

# Every check appends its result here so the run ends with one verdict
# instead of a wall of output you have to read carefully.
failures = []


def check(label, actual, expected):
    """
    Compares one value and records the outcome.

    Args:
        label (str): What is being checked, for the printed line.
        actual: The value the route produced.
        expected: The value it should have produced.

    Returns:
        None. Prints a line and appends to `failures` on a mismatch.
    """
    if actual == expected:
        print(f"    PASS  {label}: {actual}")
    else:
        print(f"    FAIL  {label}: got {actual}, expected {expected}")
        failures.append(f"{label}: got {actual}, expected {expected}")


client = create_app().test_client()
conn = get_db_connection()
cursor = conn.cursor(dictionary=True)

try:
    # ---------------------------------------------------------------
    # 1. The row count agrees with a separately written query.
    #    Comparing the route against its own SQL would prove nothing, so
    #    the expected value is computed here instead.
    # ---------------------------------------------------------------
    print("\n1. Reports within 10 miles of Chicago")

    cursor.execute(
        """
        SELECT COUNT(*) AS total
        FROM CommunityReport
        WHERE Latitude BETWEEN %(lat)s - 0.1448 AND %(lat)s + 0.1448
            AND Longitude BETWEEN
                %(lon)s - 10 / 69.17 * COS(RADIANS(%(lat)s))
                AND %(lon)s + 10 / 69.17 * COS(RADIANS(%(lat)s))
        """,
        {"lat": CHICAGO_LAT, "lon": CHICAGO_LON}
    )
    expected_total = cursor.fetchone()['total']

    response = client.get(
        f'/api/reports/nearby?lat={CHICAGO_LAT}&lon={CHICAGO_LON}'
    )
    body = response.get_json()

    check("status", response.status_code, 200)
    check("total", body['total'], expected_total)
    check("data length matches total", len(body['data']), body['total'])

    cursor.execute("SELECT COUNT(*) AS total FROM CommunityReport")
    all_reports = cursor.fetchone()['total']
    print(f"    {expected_total} of {all_reports} reports are near Chicago")

    # If the filter matched everything, the WHERE clause isn't doing anything
    # and the count above would agree for the wrong reason.
    if expected_total >= all_reports:
        print("    FAIL  every report matched -- the radius filter is inert")
        failures.append("radius filter matched every report")
    else:
        print("    PASS  the radius filter excludes distant reports")

    # ---------------------------------------------------------------
    # 2. Column types. SUM() and AVG() arrive as Decimal, which Flask
    #    serializes as a JSON string ("5.5", not 5.5) -- that would break
    #    arithmetic in the frontend.
    # ---------------------------------------------------------------
    print("\n2. Numbers arrive as numbers")

    # Every check below reads row 0, so stop here rather than raise IndexError
    # against an empty result. Exits non-zero from the finally block; there is
    # no partial verdict worth printing when there is no data to check.
    if not body['data']:
        print("    FAIL  no reports near Chicago -- nothing left to check")
        sys.exit(1)

    row = body['data'][0]
    check("AvgLimitingMag is a number",
          isinstance(row['AvgLimitingMag'], (int, float)), True)
    check("MilesAway is a number",
          isinstance(row['MilesAway'], (int, float)), True)
    check("NearbyObservations is an int",
          isinstance(row['NearbyObservations'], int), True)
    check("DaysAgo is an int", isinstance(row['DaysAgo'], int), True)

    # ---------------------------------------------------------------
    # 3. The display columns the design doc's query omits. ReportID was
    #    already in its GROUP BY; the rest are added so the page can render
    #    a report the same way the Community tab does.
    # ---------------------------------------------------------------
    print("\n3. Display columns")

    ids = [r['ReportID'] for r in body['data']]
    check("every row has a ReportID", all(isinstance(i, int) for i in ids), True)
    # The frontend keys on ReportID, so a duplicate would silently drop a card.
    check("ReportIDs are unique", len(set(ids)), len(ids))
    check("every row has the author key",
          all('UserName' in r for r in body['data']), True)

    # The route only claims a 10 mile radius, so nothing should be well past
    # it. The box is a square, so a corner can sit a little over.
    furthest = max(r['MilesAway'] for r in body['data'])
    check("furthest report is within the box",
          furthest <= 10 * 1.5, True)
    print(f"    furthest of the {len(body['data'])} is {furthest} miles")

    # ---------------------------------------------------------------
    # 4. NearbyObservations counts readings, not rows. LimitingMag is NULL
    #    where no measurement was recorded, and COUNT ignores NULL -- so a
    #    row-count would claim readings that never reached the average.
    # ---------------------------------------------------------------
    print("\n4. Readings are counted, not rows")

    cursor.execute(
        """
        SELECT c.ReportID,
               COUNT(l.ObservationID) AS Rows_,
               COUNT(l.LimitingMag)   AS Readings
        FROM CommunityReport c
            LEFT JOIN LightPollutionObservation l
                ON l.Latitude BETWEEN c.Latitude - 0.1448 AND c.Latitude + 0.1448
                AND l.Longitude BETWEEN
                    c.Longitude - 10 / 69.17 * COS(RADIANS(c.Latitude))
                    AND c.Longitude + 10 / 69.17 * COS(RADIANS(c.Latitude))
        GROUP BY c.ReportID
        """
    )
    counts = {r['ReportID']: r for r in cursor.fetchall()}

    mismatched = [r['ReportID'] for r in body['data']
                  if r['NearbyObservations'] != counts[r['ReportID']]['Readings']]
    check("every reading count matches a separate query", mismatched, [])

    # Without at least one report whose box holds an unmeasured observation,
    # COUNT(LimitingMag) and COUNT(ObservationID) agree and this proves
    # nothing.
    demonstrating = [r['ReportID'] for r in body['data']
                     if counts[r['ReportID']]['Rows_']
                     != counts[r['ReportID']]['Readings']]
    if demonstrating:
        example = counts[demonstrating[0]]
        print(f"    report {example['ReportID']}: {example['Rows_']} "
              f"observations in the box, {example['Readings']} measured")
        print("    PASS  a row count would have overstated at least one report")
    else:
        print("    FAIL  no report here separates readings from rows")
        failures.append("no report separates readings from rows")

    # ---------------------------------------------------------------
    # 5. Ordering. The query sorts by DaysAgo, so newest comes first.
    # ---------------------------------------------------------------
    print("\n5. Newest first")

    days = [r['DaysAgo'] for r in body['data']]
    check("DaysAgo is ascending", days == sorted(days), True)

    # ---------------------------------------------------------------
    # 6. Somewhere with no reports returns an empty list, not an error.
    # ---------------------------------------------------------------
    print("\n6. Open ocean (no reports nearby)")

    empty = client.get('/api/reports/nearby?lat=0&lon=-140').get_json()
    check("total", empty['total'], 0)
    check("data", empty['data'], [])

    # ---------------------------------------------------------------
    # 7. Rejections.
    # ---------------------------------------------------------------
    print("\n7. Rejections")

    check("missing lon", client.get('/api/reports/nearby?lat=41').status_code,
          400)
    check("missing both", client.get('/api/reports/nearby').status_code, 400)
    check("latitude out of range",
          client.get('/api/reports/nearby?lat=999&lon=0').status_code, 400)
    check("longitude out of range",
          client.get('/api/reports/nearby?lat=0&lon=999').status_code, 400)

finally:
    cursor.close()
    conn.close()

print()
if failures:
    print(f"{len(failures)} check(s) failed:")
    for failure in failures:
        print(f"  - {failure}")
    sys.exit(1)

print("All checks passed.")
