import { useState } from "react";
import {
  Search, SlidersHorizontal, ListPlus, Telescope
} from "lucide-react";
import { ALL_TYPES, TYPE_COLORS } from "./types";
import { TYPE_ICONS } from "./type-icons";
import type { CelestialObject, ObjectType, ObservationList } from "./types";
import { TypeBadge } from "./TypeBadge";
import { Pager } from "./Pager";
import { AddToListDialog } from "./AddToListDialog";

/**
 * Data structure for raw JSON results from /api/search.
 * @see {@link ../../../app/routes/search.py}
 */
export type SearchData = {
  data: CelestialObject[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * @param lists  The logged-in user's ObservationLists, for AddToListDialog
 * @param onAddToList  Saves a CelestialObject to one of the user's lists
 * @param onCreateList  Creates a new ObservationList
 * @param isLoggedIn  Is the user logged in
 * @param onLoginRequired  Determines whether a user needs to be logged in to
 *                         access a feature
 * @param query  The name/constellation the user is searching for
 * @param onSetQuery  Handles when query changes
 * @param onSearch  Handles when the user has clicked the search button
 * @param selectedTypes  Object categories the results are currently filtered to
 * @param onToggleType  Toggles a single object category filter on/off
 * @param onClearTypes  Clears all object category filters
 * @param usingGeolocation  whether or not the user's location was received
 *                          from the browser
 */
interface ExploreViewProps {
  lists: ObservationList[];
  onAddToList: (listId: number, objectId: number) => void;
  onCreateList: (name: string, lat: string, lng: string) => Promise<ObservationList | null>;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  query: string;
  onSetQuery: (q: string) => void;
  onSearch: () => void;
  loadingResults: boolean;
  results: SearchData | null;
  currentPage: number;
  onSetCurrentPage: (page: number) => void;
  selectedTypes: Set<ObjectType>;
  onToggleType: (t: ObjectType) => void;
  onClearTypes: () => void;
  visibleTonight: boolean;
  onToggleVisibility: (on: boolean) => void;
}

export function ExploreView({
  lists,
  onAddToList,
  onCreateList,
  isLoggedIn,
  onLoginRequired,
  query,
  onSetQuery,
  onSearch,
  loadingResults,
  results,
  currentPage,
  onSetCurrentPage,
  selectedTypes,
  onToggleType,
  onClearTypes,
  visibleTonight,
  onToggleVisibility,
}: ExploreViewProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);
  const [addToListTarget, setAddToListTarget] = useState<CelestialObject | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* TODO: if the user doesn't accept loc perms/it fails, add inputs for lat/lon */}
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
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="join grow-1">
          <label className="input input-warning join-item flex-1 border-warning/50">
            <Search size={16} />
            <input id="search" type="search" value={query}
              onChange={(e) => onSetQuery(e.target.value)}
              required placeholder="Search by name or constellation" />
          </label>
          <button onClick={() => onSearch()} disabled={loadingResults}
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
          <input type="checkbox" checked={visibleTonight}
            onChange={(e) => onToggleVisibility(e.target.checked)}
            className={`toggle${visibleTonight ? " toggle-warning" : ""}`} />
        </label>
        <button onClick={() => setShowFilters((v) => !v)}
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
                <button key={t} onClick={() => onToggleType(t)}
                  className={
                    `btn btn-sm btn-outline transition-colors ${
                      selectedTypes.has(t)
                        ? TYPE_COLORS[t] + " border-current/30"
                        : " text-neutral-content hover:text-white"
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
            <button onClick={onClearTypes}
              className="btn btn-link text-neutral-content hover:text-white"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {/* Results count */}
        {results !== null && (
          <p className="text-primary font-mono">
            {`${results?.total} object${results?.total !== 1 ? "s" : ""}`}
          </p>
        )}

        {/* Display a pager when there's >1 page of results. 24 comes from the
          page size in the search route's definition. */}
        {results !== null && results.total > 48 && (
          <Pager currentPage={currentPage}
            numberOfPages={Math.ceil(results.total / 48)}
            onSetCurrentPage={onSetCurrentPage}
          />
        )}
      </div>

      {/* Card grid */}
      {/* When results is null (falsy), the user hasn't searched yet. */}
      {results !== null && results.total > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.data.map((obj) => {
            return (
              <div key={obj.ObjectID}
                className="bg-base-100 card card-border border-neutral transition-all cursor-pointer"
                onClick={() => setSelectedObject(obj)}
              >
                <div className="card-body">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <TypeBadge color={TYPE_COLORS[obj.ObjectCategory]}
                        icon={TYPE_ICONS[obj.ObjectCategory]}
                        objectType={obj.ObjectCategory}
                        extraClasses="badge-sm mb-1"
                      />
                      <h2 className="card-title">{obj.Name}</h2>
                      <p className="text-sm font-mono">{obj.Constellation}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isLoggedIn) { onLoginRequired(); return; }
                        setAddToListTarget(obj);
                      }}
                      title="Add to an observation list"
                      className="shrink-0 btn btn-square btn-soft transition-colors"
                    >
                      <ListPlus className="size-[1.2em]" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm font-mono">
                    <span>Mag {obj.Magnitude > 0 ? "+" : ""}{obj.Magnitude}</span>
                    {obj.Altitude !== undefined
                      ? <span>Alt: {obj.Altitude}°</span>
                      : <span>Visible tonight?</span>}
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
      {results !== null && results.total === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-content">
          <Telescope size={32} className="opacity-40" />
          <p>No objects match your search.</p>
          <button className="btn btn-soft btn-primary"
            onClick={() => { onSetQuery(""); onClearTypes(); }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Object detail modal */}
      <dialog id="detailModal" className="modal" open={!!selectedObject}
        onClose={() => setSelectedObject(null)}
        onCancel={() => setSelectedObject(null)}
      >
        {selectedObject && (
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
              color={TYPE_COLORS[selectedObject.ObjectCategory ?? 'Unidentified']}
              icon={TYPE_ICONS[selectedObject.ObjectCategory ?? 'Unidentified']}
              objectType={selectedObject.ObjectCategory ?? 'Unidentified'}
              extraClasses="mb-2"
            />
            <h3 className="mb-1 text-xl">
              {selectedObject.Name ?? selectedObject.ObjectID}
            </h3>
            <div className="mb-4">
              Area of the sky:
              <span className="font-mono"> {selectedObject.Constellation}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ["Magnitude",
                  selectedObject.Magnitude ?? NaN > 0 ?
                    `+${selectedObject.Magnitude}` : `${selectedObject.Magnitude}`
                ],
                ["Right Ascension", selectedObject.RightAscension + "°"],
                ["Declination", selectedObject.Declination + "°"],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg bg-base-300 p-3">
                  <p className="text-sm mb-1 font-mono">{label}</p>
                  <p className="font-mono">{val}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setAddToListTarget(selectedObject); setSelectedObject(null); }}
              className="btn btn-block btn-warning"
            >
              Add to a list
            </button>
          </div>
        )}
      </dialog>

      <AddToListDialog
        open={!!addToListTarget}
        object={addToListTarget}
        lists={lists}
        onAddToList={onAddToList}
        onCreateList={onCreateList}
        onClose={() => setAddToListTarget(null)}
      />
    </div>
  );
}
