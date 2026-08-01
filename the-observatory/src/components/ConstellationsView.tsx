import { useState, useEffect, useMemo } from "react";
import {
  ChevronDown, ExternalLink, MapPin, Plus, Telescope, Check,
} from "lucide-react";
import { flaskFetch } from './api';
import type { ConstellationStar, ConstellationVisibility } from "./types";
import { ConstellationMap } from "./ConstellationMap";

/**
 * Raw JSON from /api/constellations. `data` is ranked most-visible first and
 * only covers constellations with a star bright enough to count; `stars` is
 * keyed by constellation and covers more of them, since it uses a looser
 * magnitude so figures have enough stars to show their shape.
 * @see {@link ../../../app/routes/constellations.py}
 */
type ConstellationData = {
  data: ConstellationVisibility[];
  stars: Record<string, ConstellationStar[]>;
  total: number;
  lat: number;
  lon: number;
  max_magnitude: number;
  star_magnitude: number;
};

/**
 * One of the user's observation lists, from /api/users/<id>/lists.
 * @see {@link ../../../app/routes/lists.py}
 */
type ObservationList = {
  ListID: number;
  ListName: string;
  ObjectCount: number;
};

type ListsData = {
  data: ObservationList[];
  total: number;
};

/** What the add-constellation route reports back. */
type AddConstellationResponse = {
  data: {
    constellation: string;
    star_count: number;
    visible_count: number;
    added: number;
    already_on_list: number;
  };
};

/** A ranking row joined to its stars, plus the browse-only entries. */
type Row = {
  name: string;
  /** Null for constellations with no star bright enough to be ranked. */
  visibility: ConstellationVisibility | null;
  stars: ConstellationStar[];
};

type SortMode = "visible" | "name";

/**
 * @param latitude  starting latitude, from the browser's geolocation
 * @param longitude  starting longitude, from the browser's geolocation
 *
 * The coordinates seed an editable copy held here, so checking another sky
 * leaves the location the rest of the app uses alone.
 */
interface ConstellationsViewProps {
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  latitude?: string | number;
  longitude?: string | number;
  currentUserID?: number;
}

export function ConstellationsView({
  isLoggedIn,
  onLoginRequired,
  latitude,
  longitude,
  currentUserID,
}: ConstellationsViewProps) {
  const [lat, setLat] = useState<string>('');
  const [lon, setLon] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<ConstellationData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("visible");
  const [lists, setLists] = useState<ObservationList[]>([]);
  const [selectedListID, setSelectedListID] = useState<number | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  // Keyed by constellation, so each row reports its own outcome.
  const [addResults, setAddResults] = useState<Record<string, string>>({});

  const handleFetchConstellations = async (lat: number, lon: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      params.set('lat', String(lat));
      params.set('lon', String(lon));

      // No magnitude sent: the route's default is the counting cutoff, and it
      // picks its own looser one for the maps.
      setResult(await flaskFetch<ConstellationData>(
        `/api/constellations?${params.toString()}`
      ));
    } catch (error) {
      console.error('Failed to fetch constellations:', error);
      setLoadError(
        error instanceof Error ? error.message : 'Could not load constellations.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFetchLists = async (userID: number) => {
    try {
      const results = await flaskFetch<ListsData>(`/api/users/${userID}/lists`);
      setLists(results.data);

      // The CreateDefaultObservationList trigger gives every user a list, so
      // there is normally something to preselect.
      if (results.data.length > 0) setSelectedListID(results.data[0].ListID);
    } catch (error) {
      console.error('Failed to fetch observation lists:', error);
    }
  };

  const handleAddConstellation = async (constellation: string) => {
    if (!isLoggedIn) { onLoginRequired(); return; }
    if (selectedListID === null) return;

    setAddingTo(constellation);
    try {
      const response = await flaskFetch<AddConstellationResponse>(
        `/api/lists/${selectedListID}/constellations`,
        {
          method: 'POST',
          body: JSON.stringify({
            constellation,
            observed_status: 'not seen',
          }),
        }
      );

      const { added, already_on_list } = response.data;
      setAddResults((prev) => ({
        ...prev,
        [constellation]: added > 0
          ? `Added ${added} star${added !== 1 ? 's' : ''}`
          : `Already saved (${already_on_list})`,
      }));

      // Keep the selector's object counts honest after a write.
      setLists((prev) => prev.map((list) => list.ListID === selectedListID
        ? { ...list, ObjectCount: list.ObjectCount + added }
        : list));
    } catch (error) {
      console.error('Failed to add constellation:', error);
      setAddResults((prev) => ({
        ...prev,
        [constellation]: error instanceof Error ? error.message : 'Failed',
      }));
    } finally {
      setAddingTo(null);
    }
  };

  // useGeolocation reports empty strings until the browser answers, so wait
  // for real numbers before seeding the boxes and fetching.
  useEffect(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      setLat(String(latitude));
      setLon(String(longitude));
      handleFetchConstellations(latitude, longitude);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (currentUserID) handleFetchLists(currentUserID);
    else { setLists([]); setSelectedListID(null); }
  }, [currentUserID]);

  // Every constellation with stars to draw, whether or not it earned a
  // ranking row. Those with nothing brighter than the counting cutoff are
  // listed unranked.
  const rows = useMemo<Row[]>(() => {
    if (!result) return [];

    const stars = result.stars ?? {};
    const ranked = new Map((result.data ?? []).map((r) => [r.Constellation, r]));
    const names = new Set([...Object.keys(stars), ...ranked.keys()]);

    const all: Row[] = [...names].map((name) => ({
      name,
      visibility: ranked.get(name) ?? null,
      stars: stars[name] ?? [],
    }));

    if (sortMode === "name") {
      return all.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Ranked rows first, ordered by how many stars are actually visible. A
    // constellation with one bright star scores 100% on percentage alone.
    return all.sort((a, b) => {
      const av = a.visibility?.VisibleCount ?? -1;
      const bv = b.visibility?.VisibleCount ?? -1;
      if (av !== bv) return bv - av;
      return (b.visibility?.StarCount ?? 0) - (a.visibility?.StarCount ?? 0);
    });
  }, [result, sortMode]);

  const totalVisible = result?.data.reduce(
    (sum, r) => sum + r.VisibleCount, 0
  ) ?? 0;

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div>
        <h1 className="font-semibold text-2xl">Constellations Tonight</h1>
        <p className="text-sm">
          How much of each constellation punches through the light pollution
          where you are. Expand one to see its stars plotted from the catalog.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="label font-mono" htmlFor="constellation-lat">
            Latitude
          </label>
          {/* String, not number: valueAsNumber is NaN for a half-typed "-"
            or "40.", which wipes the box mid-entry. */}
          <input type="number" id="constellation-lat" value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="input focus-visible:input-warning" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="label font-mono" htmlFor="constellation-lon">
            Longitude
          </label>
          <input type="number" id="constellation-lon" value={lon}
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
            handleFetchConstellations(parsedLat, parsedLon);
          }}
          disabled={loading}
        >
          <MapPin className="size-[1.2em]" />
          {loading ? 'Checking...' : 'Check this sky'}
        </button>
      </div>

      {/* Where the [+] buttons send stars. Signed-out users still get the
        whole ranking; only adding needs an account. */}
      {isLoggedIn && lists.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="label font-mono" htmlFor="target-list">
            Adding to
          </label>
          <select id="target-list" value={selectedListID ?? ''}
            onChange={(e) => setSelectedListID(Number(e.target.value))}
            className="select focus-visible:select-warning w-auto"
          >
            {lists.map((list) => (
              <option key={list.ListID} value={list.ListID}>
                {list.ListName} ({list.ObjectCount})
              </option>
            ))}
          </select>
        </div>
      )}

      {loadError && (
        <div role="alert" className="alert alert-error">
          <span>{loadError}</span>
        </div>
      )}

      {result && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-primary font-mono">
            {`${rows.length} constellations, ${totalVisible} stars visible`}
          </p>
          <div className="join">
            <button
              onClick={() => setSortMode("visible")}
              className={`btn btn-sm join-item${sortMode === 'visible' ? ' btn-warning' : ' btn-soft'}`}
            >
              Most visible
            </button>
            <button
              onClick={() => setSortMode("name")}
              className={`btn btn-sm join-item${sortMode === 'name' ? ' btn-warning' : ' btn-soft'}`}
            >
              A-Z
            </button>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-content">
          <Telescope size={32} className="opacity-40" />
          <p>Set a location to see tonight's constellations.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const isOpen = expanded === row.name;
          const ratio = row.visibility
            ? row.visibility.VisibleCount / row.visibility.StarCount
            : 0;

          return (
            <div key={row.name}
              className="card card-border border-neutral bg-base-200"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : row.name)}
                aria-expanded={isOpen}
                className="card-body flex-row items-center gap-4 text-left hover:bg-base-300/40 transition-colors"
              >
                <h2 className="card-title grow-1">{row.name}</h2>

                {row.visibility ? (
                  <>
                    <span className="font-mono text-sm whitespace-nowrap">
                      {row.visibility.VisibleCount} visible
                      <span className="opacity-60">
                        {` of ${row.visibility.StarCount}`}
                      </span>
                    </span>
                    {/* From the counts; VisibilityPercentage is a string. */}
                    <progress className="progress progress-warning w-24 hidden sm:block"
                      value={ratio} max={1} />
                    <span className="font-mono text-sm w-12 text-right">
                      {row.visibility.VisibilityPercentage}
                    </span>
                  </>
                ) : (
                  <span className="badge badge-soft badge-neutral font-mono">
                    not ranked
                  </span>
                )}

                <ChevronDown
                  className={`size-[1.2em] shrink-0 transition-transform${isOpen ? ' rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="card-body pt-0 flex-col gap-4">
                  {row.stars.length > 0 ? (
                    <ConstellationMap stars={row.stars} label={row.name} />
                  ) : (
                    <p className="text-sm opacity-70">
                      No stars bright enough to plot from the catalog.
                    </p>
                  )}

                  {!row.visibility && (
                    <p className="text-sm opacity-70">
                      Nothing here is bright enough to be ranked, but the
                      constellation is still up there.
                    </p>
                  )}

                  <div className="card-actions items-center">
                    <button className="btn btn-primary btn-sm"
                      onClick={() => handleAddConstellation(row.name)}
                      disabled={
                        addingTo === row.name
                        || (isLoggedIn && selectedListID === null)
                      }
                    >
                      {addResults[row.name]
                        ? <Check className="size-[1.2em]" />
                        : <Plus className="size-[1.2em]" />}
                      {addingTo === row.name ? 'Adding...' : 'Add to my list'}
                    </button>

                    <a className="btn btn-sm btn-soft"
                      href={`https://en.wikipedia.org/wiki/${encodeURIComponent(row.name)}_(constellation)`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-[1.2em] " />
                      History &amp; mythology
                    </a>

                    {addResults[row.name] && (
                      <span className="font-mono text-sm text-primary">
                        {addResults[row.name]}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
