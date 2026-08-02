import { useState, useEffect } from "react";
import { ChevronDown, Lightbulb, LocateFixed, MapPin, Telescope } from "lucide-react";
import { flaskFetch } from './api';
import type { NearbyReport } from "./types";

/**
 * Raw JSON from /api/reports/nearby, newest report first. Not paginated --
 * the route returns everything within about 10 miles.
 * @see {@link ../../../app/routes/nearby_reports.py}
 */
type NearbyReportsData = {
  data: NearbyReport[];
  total: number;
  lat: number;
  lon: number;
};

// What a limiting magnitude looks like to stand under. Bortle is only partly
// defined by limiting magnitude, so these are bands, not a conversion.
const SKY_BANDS = [
  {
    floor: 6.5, label: "Bortle 1-2",
    note: "Truly dark. The Milky Way is bright enough to cast shadows.",
  },
  {
    floor: 5.5, label: "Bortle 3-4",
    note: "Rural. The Milky Way is obvious overhead.",
  },
  {
    floor: 4.5, label: "Bortle 4-5",
    note: "Rural to suburban. The Milky Way shows overhead but washes out near the horizon.",
  },
  {
    floor: 3.5, label: "Bortle 6",
    note: "Bright suburban. No Milky Way, but the constellations still read clearly.",
  },
  {
    floor: 2.5, label: "Bortle 7",
    note: "Suburban to urban. Only the brighter stars of each constellation.",
  },
  {
    floor: 0, label: "Bortle 8-9",
    note: "City sky. Bright stars and planets, and little else.",
  },
];

/**
 * @param latitude  starting latitude, from the browser's geolocation
 * @param longitude  starting longitude, from the browser's geolocation
 * @param onRequestLocation  asks the browser for the location again
 * @param locating  whether a location request is in flight
 *
 * The coordinates seed an editable copy held here, so looking somewhere else
 * leaves the location the rest of the app uses alone.
 */
interface NearbyReportsProps {
  latitude?: string | number;
  longitude?: string | number;
  onRequestLocation: () => void;
  locating: boolean;
}

export function NearbyReports({
  latitude, longitude, onRequestLocation, locating
}: NearbyReportsProps) {
  const [lat, setLat] = useState<string>('');
  const [lon, setLon] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<NearbyReportsData | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleFetchNearby = async (lat: number, lon: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      params.set('lat', String(lat));
      params.set('lon', String(lon));

      setResult(await flaskFetch<NearbyReportsData>(
        `/api/reports/nearby?${params.toString()}`
      ));
    } catch (error) {
      console.error('Failed to fetch nearby reports:', error);
      setLoadError(
        error instanceof Error ? error.message : 'Could not load nearby reports.'
      );
    } finally {
      setLoading(false);
    }
  };

  // useGeolocation reports empty strings until the browser answers, so wait
  // for real numbers before seeding the boxes and fetching.
  useEffect(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      setLat(String(latitude));
      setLon(String(longitude));
      handleFetchNearby(latitude, longitude);
    }
  }, [latitude, longitude]);

  const reports = result?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        Reports written within about 10 miles of a location, with the light
        pollution measured around each one.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="label font-mono" htmlFor="nearby-lat">
            Latitude
          </label>
          {/* String, not number: valueAsNumber is NaN for a half-typed "-"
            or "40.", which wipes the box mid-entry. */}
          <input type="number" id="nearby-lat" value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="input focus-visible:input-warning" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="label font-mono" htmlFor="nearby-lon">
            Longitude
          </label>
          <input type="number" id="nearby-lon" value={lon}
            onChange={(e) => setLon(e.target.value)}
            className="input focus-visible:input-warning" />
        </div>
        <button className="btn btn-warning"
          onClick={() => {
            const parsedLat = Number(lat);
            const parsedLon = Number(lon);
            if (lat === '' || lon === ''
              || Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
              setLoadError('Enter a latitude and longitude first.');
              return;
            }
            handleFetchNearby(parsedLat, parsedLon);
          }}
          disabled={loading}
        >
          <MapPin className="size-[1.2em]" />
          {loading ? 'Checking...' : 'Find nearby reports'}
        </button>
        <button className="btn btn-soft"
          onClick={onRequestLocation}
          disabled={locating || loading}
        >
          <LocateFixed className="size-[1.2em]" />
          {locating ? 'Locating...' : 'Use my location'}
        </button>
      </div>

      {loadError && (
        <div role="alert" className="alert alert-error">
          <span>{loadError}</span>
        </div>
      )}

      {result && (
        <p className="text-primary font-mono">
          {`${result.total} report${result.total !== 1 ? 's' : ''} within 10 miles`}
        </p>
      )}

      {!loading && reports.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-content">
          <Telescope size={32} className="opacity-40" />
          <p>
            {result
              ? 'Nobody has reported from within 10 miles of here yet.'
              : 'Use your location, or type coordinates, to see what observers nearby are reporting.'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {reports.map((report) => {
          const isOpen = expanded === report.ReportID;
          const band = SKY_BANDS.find((b) => report.AvgLimitingMag >= b.floor)
            ?? SKY_BANDS[SKY_BANDS.length - 1];

          return (
            <div key={report.ReportID}
              className="card card-border border-neutral bg-base-200"
            >
              <div className="card-body">
                <h2 className="card-title">
                  {report.UserName ?? 'Anonymous'}
                  <span className="px-2 text-sm font-mono">
                    {report.CreatedAt.replace(/:00\s/, ' ')}
                  </span>
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-soft badge-primary badge-lg font-mono">
                    <MapPin className="size-[1.2em]" />
                    <span>
                      {report.Latitude.toFixed(2)}°{
                        report.Latitude > 0 ? 'N, '
                          : report.Latitude < 0 ? 'S, ' : ', '
                      }
                    </span>
                    <span>
                      {report.Longitude.toFixed(2)}°{
                        report.Longitude > 0 ? 'E'
                          : report.Longitude < 0 ? 'W' : ''
                      }
                    </span>
                  </span>

                  {/* Plain text rather than a badge: badge-soft badge-neutral
                    is the muted style, too low-contrast to read a number in. */}
                  <span className="font-mono text-sm opacity-70">
                    {`${report.MilesAway.toFixed(1)} mi away`}
                  </span>

                  {/* The indicator is the toggle: the light pollution behind a
                    report is the reason to open it. */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : report.ReportID)}
                    aria-expanded={isOpen}
                    className="badge badge-soft badge-warning badge-lg font-mono cursor-pointer"
                  >
                    <Lightbulb className="size-[1.2em]" />
                    {report.NearbyObservations > 0
                      ? `${report.NearbyObservations} reading${report.NearbyObservations !== 1 ? 's' : ''}`
                      : 'no readings'}
                    <ChevronDown
                      className={`size-[1.2em] transition-transform${isOpen ? ' rotate-180' : ''}`}
                    />
                  </button>
                </div>

                <div className="text-base">{report.ReportText}</div>

                {isOpen && (
                  <div className="flex flex-col gap-2 rounded-box bg-base-300/40 p-4">
                    {report.NearbyObservations > 0 ? (
                      <>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-sm whitespace-nowrap">
                            Limiting magnitude
                            <span className="opacity-60">
                              {` ${report.AvgLimitingMag.toFixed(1)}`}
                            </span>
                          </span>
                          {/* Max 7: the faintest real reading on file. */}
                          <progress className="progress progress-warning w-24 hidden sm:block"
                            value={report.AvgLimitingMag} max={7} />
                          <span className="badge badge-soft badge-primary font-mono">
                            {band.label}
                          </span>
                        </div>
                        <p className="text-sm opacity-70">{band.note}</p>
                        <p className="text-sm opacity-70">
                          {`Averaged over ${report.NearbyObservations} light pollution reading${report.NearbyObservations !== 1 ? 's' : ''} within 10 miles of this report.`}
                        </p>
                      </>
                    ) : (
                      // The route falls back to magnitude 6 here, which would
                      // read as a pristine sky rather than as missing data.
                      <p className="text-sm opacity-70">
                        No light pollution readings within 10 miles of this
                        report, so there is nothing measured to weigh it
                        against.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
