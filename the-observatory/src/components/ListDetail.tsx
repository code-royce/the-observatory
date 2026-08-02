import { useEffect, useState } from "react";
import {
  ChevronLeft, MapPin, Pencil, Trash2, Check, X, PenLine, Telescope
} from "lucide-react";
import { flaskFetch } from './api';
import { TYPE_COLORS } from './types';
import { TYPE_ICONS } from './type-icons';
import type { ObjectType, ObservationList, SavedObject } from "./types";
import { TypeBadge } from "./TypeBadge";
import { Pager } from "./Pager";
import { ListProgress } from "./ListProgress";
import type { ListSummaryRow, ListVisibilityRow } from "./ListProgress";

const PAGE_SIZE = 48;

interface SavedObjectRow {
  ObjectID: number;
  Name: string | null;
  Magnitude: number;
  ObjectCategory: ObjectType;
  RightAscension: number;
  Declination: number;
  Constellation: string;
  // MySQL sends a TINYINT back as 0 or 1, not a JSON boolean.
  IsObserved: number;
  Notes: string | null;
  AddedAt: string;
}

interface ListDetailResponse {
  objects: SavedObjectRow[];
  summary: ListSummaryRow[];
  visibility: ListVisibilityRow[];
  total: number;
  page: number;
  limit: number;
}

function mapSavedObject(row: SavedObjectRow): SavedObject {
  return {
    objectID: row.ObjectID,
    name: row.Name,
    magnitude: row.Magnitude,
    objectCategory: row.ObjectCategory,
    rightAscension: row.RightAscension,
    declination: row.Declination,
    constellation: row.Constellation,
    isObserved: Boolean(row.IsObserved),
    notes: row.Notes,
    addedAt: row.AddedAt,
  };
}

interface ListDetailProps {
  list: ObservationList;
  onBack: () => void;
  onUpdate: (
    listId: number,
    patch: Partial<Pick<ObservationList, "name" | "lat" | "lon">>
  ) => void;
  onDelete: () => void;
  onRemoveItem: (listId: number, objectId: number) => Promise<boolean>;
  onUpdateSavedObject: (
    listId: number,
    objectId: number,
    patch: { is_observed?: boolean; notes?: string | null }
  ) => Promise<boolean>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ListDetail({
  list,
  onBack,
  onUpdate,
  onDelete,
  onRemoveItem,
  onUpdateSavedObject
}: ListDetailProps) {
  const [editingHeader, setEditingHeader] = useState(false);
  const [draftName, setDraftName] = useState(list.name);
  const [draftLat, setDraftLat] = useState(list.lat);
  const [draftLon, setDraftLon] = useState(list.lon);

  const [objects, setObjects] = useState<SavedObject[]>([]);
  const [summary, setSummary] = useState<ListSummaryRow[]>([]);
  const [visibility, setVisibility] = useState<ListVisibilityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Bumped after a save so the transaction reruns and its counts move.
  const [refreshKey, setRefreshKey] = useState(0);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftObserved, setDraftObserved] = useState(false);

  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);

  // A different list was selected -- start back on page 1 of its objects.
  // Adjusting state during render (rather than in an effect) avoids an
  // extra render pass; see https://react.dev/learn/you-might-not-need-an-effect
  const [prevListID, setPrevListID] = useState(list.listID);
  if (list.listID !== prevListID) {
    setPrevListID(list.listID);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    flaskFetch<ListDetailResponse>(`/api/lists/${list.listID}?page=${page}&limit=${PAGE_SIZE}`)
      .then((res) => {
        if (cancelled) return;
        setObjects(res.objects.map(mapSavedObject));
        setSummary(res.summary);
        setVisibility(res.visibility);
        setTotal(res.total);
      })
      .catch((error) => console.error('Failed to fetch list objects:', error));
    return () => { cancelled = true; };
    // lat/lon are dependencies because the visibility half of the response is
    // empty until the list has coordinates.
  }, [list.listID, list.lat, list.lon, page, refreshKey]);

  const startHeaderEdit = () => {
    setDraftName(list.name);
    setDraftLat(list.lat);
    setDraftLon(list.lon);
    setEditingHeader(true);
  };

  const saveHeader = () => {
    if (!draftName.trim()) return;
    onUpdate(list.listID, { name: draftName.trim(), lat: draftLat.trim(), lon: draftLon.trim() });
    setEditingHeader(false);
  };

  const cancelHeader = () => {
    setEditingHeader(false);
  };

  const startNoteEdit = (item: SavedObject) => {
    setEditingNoteId(item.objectID);
    setDraftNote(item.notes ?? "");
    setDraftObserved(item.isObserved);
  };

  const saveNote = async (objectId: number) => {
    const note = draftNote.trim();
    const notes = note === "" ? null : note;
    const ok = await onUpdateSavedObject(list.listID, objectId, {
      is_observed: draftObserved,
      notes,
    });
    if (ok) {
      setObjects((prev) => prev.map((o) => o.objectID === objectId
        ? { ...o, isObserved: draftObserved, notes }
        : o));
      setEditingNoteId(null);
      // The transaction's counts moved -- refetch rather than recompute here.
      setRefreshKey((k) => k + 1);
    }
  };

  const cancelNote = () => {
    setEditingNoteId(null);
  };

  const confirmRemove = async (objectId: number) => {
    const ok = await onRemoveItem(list.listID, objectId);
    if (ok) {
      setObjects((prev) => prev.filter((o) => o.objectID !== objectId));
      setTotal((t) => Math.max(0, t - 1));
      setRefreshKey((k) => k + 1);
    }
    setDeletingItemId(null);
  };

  return (
    <div className="pt-6 px-4 pb-8">
      {/* Back button */}
      <button onClick={onBack}
        className="btn btn-ghost btn-sm gap-1.5 text-neutral-content hover:text-base-content mb-5"
      >
        <ChevronLeft size={16} /> My Lists
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          {editingHeader ? (
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="input input-warning w-full max-w-sm text-xl font-bold"
              />
              <div className="flex gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-mono text-neutral-content">LATITUDE</label>
                  <input
                    value={draftLat}
                    onChange={(e) => setDraftLat(e.target.value)}
                    placeholder="40.7128"
                    className="input input-sm font-mono w-36"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-mono text-neutral-content">LONGITUDE</label>
                  <input
                    value={draftLon}
                    onChange={(e) => setDraftLon(e.target.value)}
                    placeholder="-74.0060"
                    className="input input-sm font-mono w-36"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveHeader}
                  className="btn btn-warning btn-sm gap-1.5"
                >
                  <Check size={14} /> Save
                </button>
                <button
                  onClick={cancelHeader}
                  className="btn btn-soft btn-sm gap-1.5"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">
                  {list.name}
                </h1>
                <button
                  onClick={startHeaderEdit}
                  title="Edit list details"
                  className="btn btn-square btn-sm btn-soft"
                >
                  <Pencil size={13} />
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-neutral-content flex-wrap font-mono">
                {(list.lat || list.lon) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} />
                    {list.lat && `${list.lat}°N`}{list.lat && list.lon && ", "}{list.lon && `${list.lon}°E`}
                  </span>
                )}
                <span>Created {formatDate(list.createdAt)}</span>
                <span className="text-warning">
                  {total} object{total !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        {!editingHeader && (
          <button
            onClick={() => setConfirmDeleteList(true)}
            className="btn btn-soft btn-sm gap-2 text-neutral-content hover:text-error shrink-0"
          >
            <Trash2 size={14} /> Delete List
          </button>
        )}
      </div>

      <ListProgress summary={summary} visibility={visibility} total={total}
        hasLocation={Boolean(list.lat && list.lon)}
        onSetLocation={startHeaderEdit}
      />

      {/* Items */}
      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-content">
          <Telescope size={32} className="opacity-30" />
          <div className="text-center">
            <p className="font-medium mb-1">No objects in this list</p>
            <p className="text-sm">Go to Explore and mark objects to add them to your lists.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {objects.map((item) => {
            const isEditingNote = editingNoteId === item.objectID;
            const isDeletingItem = deletingItemId === item.objectID;

            return (
              <div key={item.objectID} className="card card-border border-neutral bg-base-100">
                <div className="card-body p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <TypeBadge color={TYPE_COLORS[item.objectCategory]}
                          icon={TYPE_ICONS[item.objectCategory]}
                          objectType={item.objectCategory}
                          extraClasses="badge-sm"
                        />
                        {item.isObserved && (
                          <span className="badge badge-soft badge-success badge-sm font-mono">
                            <Check size={11} /> Observed
                          </span>
                        )}
                      </div>
                      <h3 className="card-title text-base">{item.name ?? item.objectID}</h3>
                      <p className="text-xs text-neutral-content font-mono">
                        {item.constellation} · Mag {item.magnitude}
                      </p>
                      <p className="text-xs text-neutral-content font-mono mt-0.5">
                        Added {formatDate(item.addedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startNoteEdit(item)}
                        title="Edit observation"
                        className="btn btn-square btn-sm btn-soft"
                      >
                        <PenLine size={13} />
                      </button>
                      {isDeletingItem ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => confirmRemove(item.objectID)}
                            className="btn btn-error btn-sm"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setDeletingItemId(null)}
                            className="btn btn-square btn-sm btn-soft"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingItemId(item.objectID)}
                          title="Remove from list"
                          className="btn btn-square btn-sm btn-soft hover:text-error"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Note section */}
                  {isEditingNote ? (
                    <div className="mt-3">
                      <label className="label cursor-pointer justify-start gap-2 mb-2">
                        <input type="checkbox" checked={draftObserved}
                          onChange={(e) => setDraftObserved(e.target.checked)}
                          className="checkbox checkbox-sm checkbox-warning"
                        />
                        <span className="text-xs font-mono text-neutral-content">
                          MARK AS OBSERVED
                        </span>
                      </label>
                      <textarea
                        autoFocus
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="Add your observation notes — conditions, equipment, what you saw…"
                        rows={3}
                        maxLength={250}
                        className="textarea w-full text-sm resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveNote(item.objectID)}
                          className="btn btn-warning btn-xs gap-1"
                        >
                          <Check size={12} /> Save
                        </button>
                        <button
                          onClick={cancelNote}
                          className="btn btn-soft btn-xs gap-1"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : item.notes ? (
                    <div className="mt-3 rounded-lg bg-base-200 p-3">
                      <p className="text-sm leading-relaxed opacity-80">{item.notes}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => startNoteEdit(item)}
                      className="btn btn-link btn-xs text-neutral-content hover:text-base-content mt-2 px-0"
                    >
                      + Add observation note
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {total > PAGE_SIZE && (
            <div className="flex justify-center pt-2">
              <Pager currentPage={page}
                numberOfPages={Math.ceil(total / PAGE_SIZE)}
                onSetCurrentPage={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete entire list confirmation */}
      <dialog className="modal" open={confirmDeleteList}
        onClose={() => setConfirmDeleteList(false)}
        onCancel={() => setConfirmDeleteList(false)}
      >
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-2">
            Delete &quot;{list.name}&quot;?
          </h3>
          <p className="text-neutral-content text-sm mb-5">
            All {total} object{total !== 1 ? "s" : ""} and notes in this list will be permanently deleted.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onDelete}
              className="btn btn-error flex-1"
            >
              Delete List
            </button>
            <button
              onClick={() => setConfirmDeleteList(false)}
              className="btn btn-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
