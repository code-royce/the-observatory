"""
Pure math for determining whether a celestial object is above the horizon
for a given observer location and moment in time, or whether it could
ever be above the horizon from a given latitude at all.

No Flask or DB imports.
Kept dependency-free so the formulas can be checked against known reference
values in isolation (see test_horizon_calculator.py at the repo root).

CelestialObject.RightAscension is stored in decimal hours (0-24), and
CelestialObject.Declination in degrees (-90 to 90)

References:
    Meeus, Jean. Astronomical Algorithms, 2nd ed. Willmann-Bell, 1998.
        Ch. 7 (Julian Date), Ch. 12 (sidereal time), Ch. 13 (equatorial to
        horizontal coordinate transformation).
    Duffett-Smith, Peter & Zwart, Jonathan. Practical Astronomy with your
        Calculator or Spreadsheet, 4th ed. Cambridge University Press.
        Covers the same formulas with more worked examples.
"""
import math
from datetime import datetime


def julian_date(dt_utc: datetime) -> float:
    """
    Converts a UTC datetime to a Julian Date.

    A Julian Date is a continuous day count from a fixed reference point
    (noon UTC, Jan 1, 4713 BC), used so two moments in time can be
    subtracted or fed into a formula without worrying about calendar
    irregularities like leap years and different month lengths.

    Args:
        dt_utc: A datetime assumed to already be in UTC (naive or aware,
            the tzinfo is ignored).

    Returns:
        The Julian Date corresponding to dt_utc.
    """
    year = dt_utc.year
    month = dt_utc.month
    day = dt_utc.day + (
        dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600
    ) / 24

    # The JD algorithm treats Jan/Feb as months 13/14 of the previous year.
    if month <= 2:
        year -= 1
        month += 12

    # 365.25 below approximates a year's length assuming every 4th year is
    # a leap year (the Julian calendar's rule).
    # `b` corrects that assumption to match the Gregorian calendar's rule
    # instead (century years are only leap years when divisible by 400).
    a = year // 100
    b = 2 - a + a // 4

    return (
        # Days elapsed since the JD epoch, using the approximate
        # year/month lengths above, then shifted (-1524.5) so day 0
        # lines up with noon UTC on Jan 1, 4713 BC.
        int(365.25 * (year + 4716))
        + int(30.6001 * (month + 1))
        + day + b - 1524.5
    )


def local_sidereal_time(jd: float, longitude_deg: float) -> float:
    """
    Computes Local Sidereal Time in degrees.

    Local Sidereal Time (LST) tracks Earth's rotation relative to the
    background stars using the same coordinate system as RightAscension (RA).
    So comparing LST to an object's RA reveals what's currently overhead.

    Args:
        jd: Julian Date, from julian_date().
        longitude_deg: Observer's longitude in degrees, east-positive
            (matches ObservationList/CommunityReport's Longitude
            convention).

    Returns:
        Local Sidereal Time in degrees, in [0, 360).
    """
    # Centuries elapsed since noon UTC, Jan 1, 2000.
    t = (jd - 2451545.0) / 36525.0
    # (Greenwich Mean Sidereal Time)
    gmst = (
        280.46061837
        + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * t ** 2
        - t ** 3 / 38710000.0
    )
    # Together they approximate how far Earth has rotated
    # relative to the stars since that epoch.

    # GMST is measured from Greenwich's meridian; shifting by the
    # observer's longitude gives Local Sidereal Time instead.
    return (gmst + longitude_deg) % 360


def altitude(
    ra_hours: float, dec_deg: float, lat_deg: float, lst_deg: float
    ) -> float:
    """
    Computes a celestial object's altitude above the observer's horizon.

    Args:
        ra_hours: Right ascension in decimal hours (0-24), as stored in
            CelestialObject.RightAscension.
        dec_deg: Declination in degrees (-90 to 90), as stored in
            CelestialObject.Declination.
        lat_deg: Observer's latitude in degrees.
        lst_deg: Local Sidereal Time in degrees, from
            local_sidereal_time().

    Returns:
        Altitude in degrees. Positive means above the horizon, negative
        means below it.
    """
    # How far the object has rotated past the observer's meridian
    # since it last crossed it.
    hour_angle_deg = lst_deg - (ra_hours * 15)
    ha, dec, lat = map(math.radians, (hour_angle_deg, dec_deg, lat_deg))

    # Standard equatorial-to-horizontal coordinate
    # conversion for altitude.
    sin_alt = (
        math.sin(dec) * math.sin(lat)
        + math.cos(dec) * math.cos(lat) * math.cos(ha)
    )
    return math.degrees(math.asin(sin_alt))


def never_visible(dec_deg: float, lat_deg: float) -> bool:
    """
    Determines whether an object can ever be seen from a given latitude,
    at any time of day or night.

    Unlike altitude(), this doesn't need a time, longitude, or right
    ascension. An object's highest possible point in the sky (at
    transit, hour angle 0) depends only on its declination and the
    observer's latitude.

    Args:
        dec_deg: Declination in degrees.
        lat_deg: Observer's latitude in degrees.

    Returns:
        True if the object never rises above the horizon from this
        latitude, at any time.
    """
    # ra_hours=0, lst_deg=0 forces hour angle to 0 (the moment of
    # transit) regardless of the object's real right ascension.
    max_altitude = altitude(ra_hours=0, dec_deg=dec_deg, lat_deg=lat_deg, lst_deg=0)
    return max_altitude <= 0