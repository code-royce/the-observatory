import { useEffect, useRef, useState } from "react";
import { Plus, MapPin, BookOpen, Telescope, Trash2, ChevronRight } from "lucide-react";
import type { ObservationList } from "./types";


function formatCoords(lat: string, lng: string): string {
  if (!lat && !lng) return "No location set";
  const parts = [];
  if (lat) parts.push(`${lat}°N`);
  if (lng) parts.push(`${lng}°E`);
  return parts.join(", ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(
    "en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface MyListsProps {
  lists: ObservationList[];
  userName: string;
  latitude?: string | number;
  longitude?: string | number;
  onCreate: (name: string, lat: string, lng: string) => void;
  onDeleteList: (listId: number) => void;
  onSelectList: (listId: number) => void;
}

export function MyLists({
  lists,
  userName,
  onCreate,
  onDeleteList,
  onSelectList
}: MyListsProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (createOpen) {
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [createOpen]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deletingId) {
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [deletingId]);

  // Covers every method of dialog closing by firing on Escape, backdrop click,
  // or dialog.close().
  const handleDialogClose = () => {
    setCreateOpen(false);
    setName("");
    setLat("");
    setLng("");
  };

  const handleDeleteDialogClose = () => {
    setDeletingId(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), lat.trim(), lng.trim());
    setName(""); setLat(""); setLng("");
    setCreateOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) { onDeleteList(deletingId); setDeletingId(null); }
  };

  return (
    <div className="pt-6 px-4 pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">
            {userName}&apos;s Observation Lists
          </h2>
          <p className="font-mono text-sm">
            {lists.length} list{lists.length !== 1 ? "s" : ""} · {lists.reduce((acc, l) => acc + l.objectCount, 0)} objects total
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn btn-warning max-sm:btn-square">
          <Plus className="size-[1.2em]"/>
          <span className="sr-only sm:not-sr-only">New List</span>
        </button>
      </div>

      {/* List grid */}
      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="bg-warning/20 w-16 h-16 rounded-full flex items-center justify-center">
            <Telescope size={28} className="text-warning opacity-60" />
          </div>
          <div className="text-center">
            <p className="text-foreground mb-1 font-medium">No observation lists yet</p>
            <p className="text-sm">Create a list to start tracking celestial objects you've observed.</p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn btn-outline btn-warning">
            <Plus size={14} /> Create your first list
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <div key={list.listID} onClick={() => onSelectList(list.listID)}
              className="card relative group border border-neutral bg-base-200/80 hover:border-base-300 hover:bg-base-300 transition-all cursor-pointer"
            >
              <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-foreground truncate mb-0.5"
                      style={{ fontWeight: 600, fontSize: "1.05rem" }}
                    >
                      {list.name}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} />
                      <span className="text-xs truncate" style={{ fontFamily: "var(--font-family-mono)" }}>
                        {formatCoords(list.lat, list.lon)}
                      </span>
                    </div>
                  </div>
                  {/* Delete button — stops card click propagation */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(list.listID); }}
                    className="btn btn-soft btn-sm btn-square opacity-0 group-hover:opacity-100 hover:btn-error transition-all"
                    title="Delete list"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(240,192,96,0.1)" }}
                    >
                      <BookOpen size={11} className="text-warning" />
                      <span className="text-xs text-warning font-mono font-semibold">
                        {list.objectCount} object{list.objectCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono">
                      {formatDate(list.createdAt)}
                    </span>
                    <ChevronRight size={13} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Dashed "New List" card */}
          <button
            onClick={() => setCreateOpen(true)}
            className="card border-2 border-dashed border-current/20 hover:border-warning/30 hover:bg-warning/5 transition-all items-center justify-center gap-3 hover:text-warning min-h-32 cursor-pointer"
          >
            <Plus size={20} />
            <span className="text-sm font-medium">New List</span>
          </button>
        </div>
      )}

      {/* Create list dialog */}
      <dialog ref={dialogRef} className="modal" onClose={handleDialogClose}>
        <div className="modal-box">
          <button type="button" aria-label="Close"
            onClick={() => dialogRef.current?.close()}
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          >
            ✕
          </button>

          <h3 className="text-lg font-bold mb-1">New Observation List</h3>
          <p className="text-sm text-base-content/60 mb-5">
            Name your list and optionally set the observation location.
          </p>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="form-control flex flex-col gap-1.5">
              <label htmlFor="list-name" className="label py-0">
                <span className="label-text text-xs font-mono">LIST NAME *</span>
              </label>
              <input id="list-name" autoFocus required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Backyard Summer Sessions"
                className="input input-bordered w-full text-sm"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 form-control flex flex-col gap-1.5">
                <label htmlFor="list-lat" className="label py-0">
                  <span className="label-text text-xs font-mono">LATITUDE</span>
                </label>
                <input id="list-lat" value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="40.7128"
                  className="input input-bordered w-full text-sm font-mono"
                />
              </div>
              <div className="flex-1 form-control flex flex-col gap-1.5">
                <label htmlFor="list-lon" className="label py-0">
                  <span className="label-text text-xs font-mono">LONGITUDE</span>
                </label>
                <input id="list-lon" value={lng} onChange={(e) => setLng(e.target.value)}
                  placeholder="-74.0060"
                  className="input input-bordered w-full text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-1">
              <button type="submit" className="btn btn-primary flex-1">
                Create List
              </button>
              <button type="button" onClick={() => dialogRef.current?.close()}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Click outside to close */}
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Delete confirmation */}
      <dialog ref={deleteDialogRef} className="modal"
        onClose={handleDeleteDialogClose}
        role="alertdialog"
        aria-labelledby="delete-list-title"
        aria-describedby="delete-list-description"
      >
        <div className="modal-box max-w-sm">
          <h3 id="delete-list-title" className="text-lg font-bold mb-2">
            Delete this list?
          </h3>
          <p id="delete-list-description" className="text-sm text-base-content/60 mb-5">
            All objects and notes in this list will be permanently deleted. This cannot be undone.
          </p>

          <div className="flex gap-3">
            <button type="button" onClick={handleDelete}
              className="btn btn-error flex-1 text-white"
            >
              Delete List
            </button>
            <button type="button" className="btn btn-outline"
              onClick={() => deleteDialogRef.current?.close()}
            >
              Cancel
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
