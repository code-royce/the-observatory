import { useState, useMemo } from "react";
import {
  Search, SlidersHorizontal, Eye, EyeOff, Star, Orbit, CircleQuestionMark,
  Sparkles, Telescope, Badge, CircleGauge, Flame, GitCommitVertical,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import type { CelestialObject, ObjectType } from "./data";
// import { useGeolocation } from "./useGeolocation";
import { TypeBadge } from "./TypeBadge";
/**
 * Star, SS, SS?: Star
 * TS: Triple Star
 * DS, DS?: Double Star
 * Gx: Galaxy
 *
 * U, ?, -: Unidentified
 * ?: Uncertain type or may not exist
 * -: unidentified, but nonexistent (object called nonexistent in the RNGC)
 *
 * Nb: Reflection Nebula
 * OC, C+N: Open Star Cluster
 * Gb: Globular Cluster
 * Pl: Planetary Nebula
 * Ast: Asterism
 * Kt: Knot/Nebulous region within external galaxy
 *
 */

/**
 * Data structure for raw JSON results from /api/search.
 * @see {@link ../../../app.py}
 */
export type SearchData = {
  data: CelestialObject[];
  total: number;
  page: number;
  pageSize: number;
};

function isVisibleTonight(obj: CelestialObject): boolean {
  // TODO convert to latitude collected from user
  const user_lat = 40.11;

  // Stars circumpolar to the user's latitude
  if (
    user_lat > 0 && (user_lat + obj.Declination > 90)
    || user_lat < 0 && (user_lat + obj.Declination < -90)
  ) {
    return true;
  }

  // TODO: Call backend utility for stars that are seasonal?

  return true;
}

const TYPE_COLORS: Record<ObjectType, string> = {
  Star: "text-yellow-300 bg-yellow-300/10",
  "Double Star": "text-rose-400 bg-rose-400/10",
  "Triple Star": "text-cyan-400 bg-cyan-400/10",
  Galaxy: "text-blue-400 bg-blue-400/10",
  Unidentified: "text-gray-400 bg-gray-400/10",
  "Reflection Nebula": "text-purple-400 bg-purple-400/10",
  "Open Cluster": "text-green-400 bg-green-400/10",
  "Globular Cluster": "text-orange-400 bg-orange-400/10",
  "Planetary Nebula": "",
  Asterism: "text-amber-300 bg-amber-300/10",
  Knot: "text-fuchsia-400 bg-fuchsia-400/10"
};

const TYPE_ICONS: Record<ObjectType, React.ReactNode> = {
  Star: <Star size={12} />,
  "Double Star": <Star size={12} />,
  "Triple Star": <Star size={12} />,
  Galaxy: <Orbit size={12} />,
  Unidentified: <CircleQuestionMark size={12} />,
  "Reflection Nebula": <Sparkles size={12}/>,
  "Open Cluster": <Telescope size={12} />,
  "Globular Cluster": <Badge size={12}/>,
  "Planetary Nebula": <CircleGauge size={12}/>,
  Asterism: <Flame size={12} />,
  Knot: <GitCommitVertical size={12}/>,
};

const ALL_TYPES: ObjectType[] = [
  "Star", "Double Star", "Triple Star", "Galaxy", "Unidentified",
  "Reflection Nebula", "Open Cluster", "Globular Cluster", "Planetary Nebula",
  "Asterism", "Knot"];

/**
 * @param observed  CelestialObjects the user has marked as observed
 * @param onToggleObserved  Changes the observed status of a CelestialObject for
 *                          a logged in user; opens the login modal otherwise
 * @param isLoggedIn  Is the user logged in
 * @param onLoginRequired  Determines whether a user needs to be logged in to
 *                         access a feature
 * @param query  The name/constellation the user is searching for
 * @param onSetQuery  Handles when query changes
 * @param onSearch  Handles when the user has clicked the search button
 */
interface ExploreViewProps {
  observed: Set<number>;
  onToggleObserved: (id: number) => void;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  query: string;
  onSetQuery: (q: string) => void;
  onSearch: () => void;
  loadingResults: boolean;
  results: SearchData | null;
}

export function ExploreView({
  observed,
  onToggleObserved,
  isLoggedIn,
  onLoginRequired,
  query,
  onSetQuery,
  onSearch,
  loadingResults,
  results
}: ExploreViewProps) {
  // const [location, setLocation] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<ObjectType>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [visibleTonight, setVisibleTonight] = useState(true);
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);

  // const { loaded, coordinates, error } = useGeolocation();

  const toggleType = (t: ObjectType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  // TODO: Decide how to filter all pages of results
  const filtered = useMemo(() => {
    // Don't attempt to filter results when there aren't any.
    if (results !== null && results.total > 0) {
      return results.data.filter((obj) => {
        if (visibleTonight && !isVisibleTonight(obj)) return false;
        if (selectedTypes.size > 0 && !selectedTypes.has(obj.ObjectCategory)) return false;

        return true;
      });
    }
    return [];
  }, [results, visibleTonight, selectedTypes]);

  const handleToggle = (id: number) => {
    if (!isLoggedIn) { onLoginRequired(); return; }
    onToggleObserved(id);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* TODO: finish this feature */}
      {/* <fieldset className="fieldset">
        <legend className="fieldset-legend">
          Enter your location to get precise visibility results.
        </legend>
        <label className="label">
          <input type="checkbox" defaultChecked className="toggle toggle-primary" />
          <span className="text-primary">Use Current Location</span>
        </label>
        <label className="input flex-1">
          <input type="text" value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location" />
        </label>
      </fieldset> */}

      {/* Search and filter button */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="join flex-1 justify-stretch">
          <label className="input input-warning join-item flex-1 border-warning/50">
            <Search size={16} />
            <input id="search"
              type="search"
              value={query}
              onChange={(e) => onSetQuery(e.target.value)}
              required placeholder="Search by name or constellation" />
          </label>
          <button
            onClick={() => onSearch()}
            disabled={loadingResults}
            className="btn btn-warning join-item">Search</button>
        </div>
        <label
          className={
            `label btn border-neutral-content transition-colors${
              visibleTonight ? " border-warning/50 text-warning" : ""
            }`
          }
        >
          Visible tonight
          <input
            type="checkbox"
            checked={visibleTonight}
            onChange={(e) => setVisibleTonight(e.target.checked)}
            className={`toggle${visibleTonight ? " toggle-warning" : ""}`} />
        </label>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`btn transition-colors${showFilters ? ' btn-warning' : ' btn-soft'}`}
        >
          <SlidersHorizontal size={15} />
          Filters
        </button>
      </div>
      {/* Filters panel */}
      {showFilters && (
        <div className="z-1 bg-base-100 rounded-xl border border-current/30 p-4 flex flex-col gap-4">
          <div>
            <p className="text-sm mb-2 font-mono">OBJECT TYPE</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={
                    `btn btn-sm btn-outline transition-colors ${
                      selectedTypes.has(t) ?
                        TYPE_COLORS[t] + " border-current/30" : " text-neutral-content hover:text-white"
                    }`
                  }
                >
                  {TYPE_ICONS[t]}
                  {t}
                </button>
              ))}
            </div>
          </div>
          {(selectedTypes.size > 0 || false || false) && (
            <button
              onClick={() => { setSelectedTypes(new Set()); }}
              className="btn btn-link text-neutral-content hover:text-white"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {results !== null && (
        <p className="text-sm font-mono">
          {results?.total} object{results?.total !== 1 ? "s" : ""}
        </p>
      )}

      {/* Card grid */}
      {/* When results is null (falsy), the user hasn't searched yet. */}
      {results !== null && results.total > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.data.map((obj) => {
            const isObserved = observed.has(obj.ObjectID);
            return (
              <div
                key={obj.ObjectID}
                className="bg-base-100 card card-border transition-all cursor-pointer"
                onClick={() => setSelectedObject(obj)}
              >
                <div className="card-body">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <TypeBadge
                        color={TYPE_COLORS[obj.ObjectCategory]}
                        icon={TYPE_ICONS[obj.ObjectCategory]}
                        objectType={obj.ObjectCategory}
                        extraClasses="badge-sm mb-1"
                      />
                      <h2 className="card-title">{obj.Name}</h2>
                      <p className="text-sm font-mono">{obj.Constellation}</p>
                    </div>
                    <button
                      onClick={
                        (e) => { e.stopPropagation(); handleToggle(obj.ObjectID); }
                      }
                      title={isObserved
                        ? "Remove from an observation list"
                        : "Add to an observation list"}
                      className={`shrink-0 btn btn-square btn-soft transition-colors`}
                    >
                      {isObserved ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm font-mono">
                    <span>Mag {obj.Magnitude > 0 ? "+" : ""}{obj.Magnitude}</span>
                    <span>Visible tonight?</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        ''
      )}

      {/* No results message: when results isn't null and total is 0, the db
        didn't return results for the user's query. */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-content">
          <Telescope size={32} className="opacity-40" />
          <p>No objects match your search.</p>
          <button
            className="btn btn-soft btn-primary"
            onClick={() => { onSetQuery(""); setSelectedTypes(new Set()); }}
          >
            Clear filters
          </button>
        </div>
      )}
      {/* TODO: finish the pager */}
      {/* Display a pager when there's >1 page of results. 24 comes from the
        page size in the search route's definition. */}
      {results !== null && results.total > 24 && (
        <div className="join justify-center">
          <button onClick={() => null} className="join-item btn btn-lg">
            <ChevronsLeft className="size-[1.2em]" />
            <span className="sr-only">First page</span>
          </button>
          <button onClick={() => null} className="join-item btn btn-lg">
            <ChevronLeft className="size-[1.2em]" />
            <span className="sr-only">Previous page</span>
          </button>
          {/* page number buttons go here */}
          <button onClick={() => null} className="join-item btn btn-lg">
            <span className="sr-only">Page </span>1
          </button>
          <button onClick={() => null} className="join-item btn btn-lg">
            <ChevronRight className="size-[1.2em]" />
            <span className="sr-only">Next page</span>
          </button>
          <button onClick={() => null} className="join-item btn btn-lg">
            <ChevronsRight className="size-[1.2em]" />
            <span className="sr-only">Last page</span>
          </button>
        </div>
      )}

      {/* Object detail modal */}
      <dialog id="detailModal" className="modal" open={!!selectedObject}
        onClose={() => setSelectedObject(null)}
        onCancel={() => setSelectedObject(null)}
      >
        <div className="modal-box">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            >
              <span className="sr-only">Close</span>
              <span aria-hidden="true">✕</span>
            </button>
          </form>
          <TypeBadge
            color={TYPE_COLORS[selectedObject?.ObjectCategory ?? 'Unidentified']}
            icon={TYPE_ICONS[selectedObject?.ObjectCategory ?? 'Unidentified']}
            objectType={selectedObject?.ObjectCategory ?? 'Unidentified'}
            extraClasses="mb-2"
          />
          <h3 className="mb-1 text-xl">{selectedObject?.Name ?? selectedObject?.ObjectID}</h3>
          <div className="mb-4">
            Area of the sky:
            <span className="font-mono"> {selectedObject?.Constellation}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              ["Magnitude",
                selectedObject?.Magnitude ?? NaN > 0 ?
                  `+${selectedObject?.Magnitude}` : `${selectedObject?.Magnitude}`
              ],
              ["Right Ascension", selectedObject?.RightAscension + "°"],
              ["Declination", selectedObject?.Declination + "°"],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg bg-base-300 p-3">
                <p className="text-sm mb-1 font-mono">{label}</p>
                <p className="font-mono">{val}</p>
              </div>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  );
}
