"""
Manual checks for app/horizon_calculator.py.

Run from the repo root: `python tests/test_horizon_calculator.py`.
Needs neither a database nor a running backend.
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

# The repo root, so `app` resolves when this runs from tests/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.horizon_calculator import (
    altitude, julian_date, local_sidereal_time, never_visible
)

# Every check appends here, so the run can end with a non-zero exit code.
failures = []


def report(passed, label):
    """
    Records one check's outcome.

    Args:
        passed (bool): Whether the check succeeded.
        label (str): What was being checked, for the failure summary.

    Returns:
        None. Prints PASS or FAIL and appends to `failures` on a miss.
    """
    if passed:
        print("  PASS")
    else:
        print("  FAIL")
        failures.append(label)


# --- Check 1: Julian Date at a known reference date -------------------

# Jan 1, 2000, 12:00 UTC is a well-known reference date in astronomy
# (called "J2000"). Its Julian Date is published: 2451545.0.

result = julian_date(datetime(2000, 1, 1, 12, 0, 0))
expected = 2451545.0

print("Check 1: Julian Date at the J2000 epoch")
print(f"  expected {expected}, got {result}")

report(abs(result - expected) < 0.01, "Julian Date at J2000")


# --- Check 2: an object directly overhead reads ~90 degrees -----------

# If a star's declination equals the observer's latitude, and its
# crossing the observer's meridian right now (hour angle 0), it should
# be straight overhead -- altitude 90 degrees.

result = altitude(ra_hours=6.0, dec_deg=40.0, lat_deg=40.0, lst_deg=90.0)
expected = 90.0

print()
print("Check 2: object directly overhead")
print(f"  expected {expected}, got {result:.2f}")

report(abs(result - expected) < 0.5, "object directly overhead")


# --- Check 3: an equatorial object, 6 hours from transit, sits on the horizon

# An object on the celestial equator (dec=0), seen from Earth's equator
# (lat=0), sets exactly 6 hours (90 degrees of hour angle) after
# transiting overhead. So at hour angle 90, it should read 0 degrees.

result = altitude(ra_hours=0.0, dec_deg=0.0, lat_deg=0.0, lst_deg=90.0)
expected = 0.0

print()
print("Check 3: equatorial object, 6 hours from transit")
print(f"  expected {expected}, got {result:.2f}")

report(abs(result - expected) < 0.5, "equatorial object on the horizon")


# --- Check 4: Polaris should never set from latitude 40N --------------

# Polaris sits almost exactly above the north pole (declination
# ~89.26 degrees). For an observer at latitude 40N, any star with
# declination above (90 - 40) = 50 degrees never sets, no matter the
# time of night. We check a few different times (Local Sidereal Times).

print()
print("Check 4: Polaris stays above the horizon all night from lat 40N")

polaris_ra = 2.530
polaris_dec = 89.264
observer_lat = 40.0

for lst in (0, 90, 180, 270):
    result = altitude(polaris_ra, polaris_dec, observer_lat, lst)
    print(f"  LST={lst}: altitude = {result:.2f} degrees")
    report(result > 0, f"Polaris above the horizon at LST={lst}")


# --- Check 5: Sigma Octantis never rises from latitude 40N ------------

# By the same logic in reverse: for an observer at latitude 40N, a star
# with declination below (40 - 90) = -50 degrees never clears the
# horizon, no matter the time of night. Sigma Octantis (aka "Polaris
# Australis") is the closest reasonably-bright real star to the south
# celestial pole.
print()
print("Check 5: Sigma Octantis never rises from lat 40N")

sigma_octantis_ra = 21.144
sigma_octantis_dec = -88.956

for lst in (0, 90, 180, 270):
    result = altitude(sigma_octantis_ra, sigma_octantis_dec, observer_lat, lst)
    print(f"  LST={lst}: altitude = {result:.2f} degrees")
    report(result < 0, f"Sigma Octantis below the horizon at LST={lst}")


# --- Check 6: never_visible() confirms Polaris CAN be seen from lat 40N ----

# Polaris is circumpolar from lat 40N,
# never_visible() should return False.

result = never_visible(polaris_dec, observer_lat)

print()
print("Check 6: can Polaris ever be seen from lat 40N?")
if result:
    print("  never_visible() returns True, so NO it can't")
else:
    print("  never_visible() returns False, so YES it can")
print("  expected: YES")

report(not result, "never_visible() says Polaris is reachable")


# --- Check 7: never_visible() confirms Sigma Octantis CANNOT be seen --------

# Sigma Octantis never rises from lat 40N (established in check 5) --
# never_visible() should agree that it's permanently out of reach.

result = never_visible(sigma_octantis_dec, observer_lat)

print()
print("Check 7: can Sigma Octantis ever be seen from lat 40N?")
if result:
    print("  never_visible() returns True, so NO it can't")
else:
    print("  never_visible() returns False, so YES it can")
print("  expected: NO")

report(result, "never_visible() says Sigma Octantis is unreachable")


# --- Reality check: are these two stars visible now in Champaign?

# Runs the actual current date/time through the full pipeline, using two
# well-known bright stars (Vega and Sirius) and their real
# RA/declination. Go outside (or check a stargazing app) and see if the
# PASS/FAIL below actually matches what's in the sky right now.

now = datetime.now(timezone.utc)
jd_now = julian_date(now)
lst_now = local_sidereal_time(jd_now, longitude_deg=-88.2434)
champaign_lat = 40.1164

vega_ra, vega_dec = 18.615, 38.784
sirius_ra, sirius_dec = 6.752, -16.716

vega_alt = altitude(vega_ra, vega_dec, champaign_lat, lst_now)
sirius_alt = altitude(sirius_ra, sirius_dec, champaign_lat, lst_now)

print()
print("Reality check -- right now, from Champaign, IL:")
print(f"  Vega:   altitude = {vega_alt:.2f} degrees, visible = {vega_alt > 0}")
print(f"  Sirius: altitude = {sirius_alt:.2f} degrees, visible = {sirius_alt > 0}")
print("  Look outside or check a stargazing app -- does this match?")

print()
if failures:
    print(f"{len(failures)} check(s) failed:")
    for failure in failures:
        print(f"  - {failure}")
    sys.exit(1)

print("All checks passed.")
