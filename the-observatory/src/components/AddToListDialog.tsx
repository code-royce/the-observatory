import { useEffect, useRef, useState } from "react";
import { Check, BookOpen, Plus, ListPlus, X } from "lucide-react";
import { TYPE_COLORS } from "./types";
import { TYPE_ICONS } from "./type-icons";
import type { CelestialObject, ObservationList } from "./types";
import { TypeBadge } from "./TypeBadge";

interface AddToListDialogProps {
  open: boolean;
  object: CelestialObject | null;
  lists: ObservationList[];
  onAddToList: (listId: number, objectId: number) => void;
  onCreateList: (name: string, lat: string, lng: string) => Promise<ObservationList | null>;
  onClose: () => void;
}

export function AddToListDialog({
  open,
  object,
  lists,
  onAddToList,
  onCreateList,
  onClose,
}: AddToListDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  // Purely cosmetic: flips a list's button to "Added" for a moment after a
  // successful click. Not real membership tracking -- see AddToListDialog's
  // design notes for why that isn't cheap to know here.
  const [justAdded, setJustAdded] = useState<Set<number>>(new Set());

  // Sync the native <dialog> open state with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    onClose();
    setCreatingNew(false);
    setNewName("");
    setNewLat("");
    setNewLng("");
  };

  const handleAdd = (listId: number) => {
    if (!object) return;
    onAddToList(listId, object.ObjectID);
    setJustAdded((prev) => new Set(prev).add(listId));
    setTimeout(() => {
      setJustAdded((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    }, 1500);
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !object) return;
    const created = await onCreateList(newName.trim(), newLat.trim(), newLng.trim());
    if (created) handleAdd(created.listID);
    setNewName("");
    setNewLat("");
    setNewLng("");
    setCreatingNew(false);
  };

  return (
    <dialog ref={dialogRef} onClose={handleClose} id="add-to-list-modal"
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby="add-to-list-modal-title"
    >
      <div className="modal-box p-0 max-w-sm overflow-y-auto rounded-xl">
        <button
          onClick={() => dialogRef.current?.close()}
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10"
        >
          <X size={16} />
          <span className="sr-only">Close</span>
        </button>

        {/* Object header */}
        {object && (
          <div className="px-5 pt-5 pb-4 border-b border-base-300">
            <TypeBadge color={TYPE_COLORS[object.ObjectCategory]}
              icon={TYPE_ICONS[object.ObjectCategory]}
              objectType={object.ObjectCategory}
              extraClasses="badge-sm"/>
            <h3 id="add-to-list-modal-title"
              className="text-base-content font-bold text-[1.05rem]"
            >
              {object.Name}
            </h3>
            <p className="text-base-content/60 text-xs mt-0.5 font-mono">
              Area of the sky: {object.Constellation}
            </p>
          </div>
        )}

        <div className="p-4">
          <p className="text-xs text-base-content/60 mb-3 font-mono">
            ADD TO LIST
          </p>

          {lists.length === 0 && !creatingNew ? (
            <div className="flex flex-col items-center gap-3 py-6 text-base-content/60">
              <ListPlus size={28} className="opacity-40" />
              <div className="text-center">
                <p className="text-base-content text-sm mb-0.5 font-medium">
                  No lists yet
                </p>
                <p className="text-xs">Create a list to start tracking this object.</p>
              </div>
            </div>
          ) : (
            <ul className="menu menu-vertical p-0 gap-1.5 mb-3 w-full max-h-52 overflow-y-auto flex-nowrap">
              {lists.map((list) => {
                const added = justAdded.has(list.listID);
                return (
                  <li key={list.listID}>
                    <button onClick={() => handleAdd(list.listID)}
                      className={`flex items-center justify-between gap-3 w-full rounded-lg border px-3 py-2.5 ${
                          added
                            ? "border-warning/30 bg-warning/10"
                            : "border-base-300 hover:border-base-content/20 hover:bg-base-200"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BookOpen size={13}
                          className={added ? "text-warning" : "text-base-content/60"}
                        />
                        <div className="min-w-0 text-left">
                          <p className="text-sm truncate text-base-content font-normal">
                            {list.name}
                          </p>
                          <p className="text-xs text-base-content/60 font-mono">
                            {list.objectCount} object{list.objectCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      {added ? (
                        <span className="badge badge-sm badge-warning gap-1 flex-shrink-0">
                          <Check size={11} /> Added
                        </span>
                      ) : (
                        <span className="badge badge-sm flex-shrink-0">Add</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* New list inline form */}
          {creatingNew ? (
            <form
              onSubmit={handleCreateAndAdd}
              className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-warning/20 bg-warning/5"
            >
              <input autoFocus required value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="List name"
                className="input input-bordered input-sm w-full"
              />
              <div className="flex gap-2">
                <input value={newLat} placeholder="Lat"
                  onChange={(e) => setNewLat(e.target.value)}
                  className="input input-bordered input-sm flex-1 font-mono"
                />
                <input value={newLng} placeholder="Lng"
                  onChange={(e) => setNewLng(e.target.value)}
                  className="input input-bordered input-sm flex-1 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-warning btn-sm flex-1">
                  Create & Add
                </button>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setCreatingNew(false);
                    setNewName("");
                    setNewLat("");
                    setNewLng("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setCreatingNew(true)}
              className="btn btn-ghost btn-sm w-full justify-start gap-2 border border-dashed border-base-300 text-base-content/60 hover:text-base-content hover:border-warning/30"
            >
              <Plus size={14} /> New list
            </button>
          )}
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
