import { useState, useMemo } from "react";
import {
  Search, SlidersHorizontal, Eye, EyeOff, Star, Orbit, CircleQuestionMark, Sparkles,
  Telescope, Badge, CircleGauge, Flame, GitCommitVertical
} from "lucide-react";
import type { CelestialObject, ObjectType } from "./data";
import { CELESTIAL_OBJECTS } from "./data";
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

interface ExploreViewProps {
  observed: Set<string>;
  onToggleObserved: (id: string) => void;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
}

export function ExploreView({
  observed,
  onToggleObserved,
  isLoggedIn, onLoginRequired
}: ExploreViewProps) {
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<ObjectType>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectedObject, setSelectedObject] = useState<CelestialObject | null>(null);

  const toggleType = (t: ObjectType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return CELESTIAL_OBJECTS.filter((obj) => {
      const q = search.toLowerCase();

      if (
        q &&
        !obj.name?.toLowerCase().includes(q) &&
        !obj.constellation.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (selectedTypes.size > 0 && !selectedTypes.has(obj.type)) return false;

      return true;
    });
  }, [search, selectedTypes]);

  const handleToggle = (id: string) => {
    if (!isLoggedIn) { onLoginRequired(); return; }
    onToggleObserved(id);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search and filter button */}
      <div className="flex gap-3 items-center">
        <label className="input flex-1">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            required placeholder="Search by name or constellation" />
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
        <div className="z-1 bg-base-100 rounded-xl border p-4 flex flex-col gap-4">
          <div>
            <p className="text-sm mb-2 font-mono">OBJECT TYPE</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`btn btn-sm btn-outline transition-colors ${selectedTypes.has(t) ? TYPE_COLORS[t] + " border-current/30" : "text-neutral-content hover:text-white"}`}
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
      <p className="text-sm font-mono">
        {filtered.length} object{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((obj) => {
          const isObserved = observed.has(obj.id);
          return (
            <div
              key={obj.id}
              className="bg-base-100 card card-border transition-all cursor-pointer"
              onClick={() => setSelectedObject(obj)}
            >
              <div className="card-body">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span
                      className={`badge badge-soft badge-sm mb-1 ${TYPE_COLORS[obj.type]}`}
                    >
                      {TYPE_ICONS[obj.type]}
                      {obj.type}
                    </span>
                    <h2 className="card-title">{obj.name}</h2>
                    <p className="text-sm font-mono">{obj.constellation}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(obj.id); }}
                    title={isObserved ? "Remove from log" : "Add to observation log"}
                    className={`shrink-0 btn btn-square btn-soft transition-colors`}
                  >
                    {isObserved ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm font-mono">
                  <span>Mag {parseFloat(obj.magnitude) > 0 ? "+" : ""}{obj.magnitude}</span>
                  <span>Visible tonight?</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No results message */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-content">
          <Telescope size={32} className="opacity-40" />
          <p>No objects match your search.</p>
          <button
            className="btn btn-soft btn-primary"
            onClick={() => { setSearch(""); setSelectedTypes(new Set()); }}
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
        <div className="modal-box">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            >
              <span className="sr-only">Close</span>
              <span aria-hidden="true">✕</span>
            </button>
          </form>
          <span
            className={`badge badge-soft mb-2 ${TYPE_COLORS[selectedObject?.type ?? 'Unidentified']}`}
          >
            {TYPE_ICONS[selectedObject?.type ?? 'Unidentified']}
            {selectedObject?.type}
          </span>
          <h3 className="mb-1 text-xl">{selectedObject?.name ?? selectedObject?.id}</h3>
          <div className="mb-4">
            Area of the sky:
            <span className="font-mono"> {selectedObject?.constellation}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              ["Magnitude",
                parseFloat(selectedObject?.magnitude ?? '') > 0 ?
                  `+${selectedObject?.magnitude}` : `${selectedObject?.magnitude}`
              ],
              ["Right Ascension", selectedObject?.ra + "°"],
              ["Declination", selectedObject?.dec + "°"],
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
