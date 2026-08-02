import { Check, Eye, MapPin, Telescope } from "lucide-react";
import { TYPE_COLORS } from './types';
import { TYPE_ICONS } from './type-icons';
import type { ObjectType } from "./types";
import { TypeBadge } from "./TypeBadge";

/**
 * Per-category progress, from the first advanced query in the read
 * transaction. Its HAVING clause drops categories the user has finished, so
 * these counts deliberately don't sum to the list's total.
 * @see {@link ../../../app/routes/lists.py}
 */
export interface ListSummaryRow {
  ObjectCategory: ObjectType;
  TotalSaved: number;
  Observed: number;
  CompletionRate: number;
}

/**
 * Per-category counts from the transaction's second advanced query, judged
 * from the list's own coordinates. Empty when the list has none saved.
 * @see {@link ../../../app/routes/lists.py}
 */
export interface ListVisibilityRow {
  ObjectCategory: ObjectType;
  OnList: number;
  Observable: number;
  UpNow: number;
}

interface ProgressRow {
  category: ObjectType;
  totalSaved: number;
  observed: number;
  completionRate: number;
  observable: number | null;
  upNow: number | null;
}

/**
 * Merges the two queries on ObjectCategory.
 *
 * The visibility query orders by UpNow first, which is the order a user
 * actually wants, so it leads when it ran at all. A category present only in
 * visibility is one the metadata query's HAVING clause dropped for being
 * finished, hence the 100% fallback.
 *
 * Args:
 *     summary: Rows from the metadata query.
 *     visibility: Rows from the visibility query, empty without coordinates.
 *
 * Returns:
 *     One row per category, in display order.
 */
function mergeRows(
  summary: ListSummaryRow[], visibility: ListVisibilityRow[]
): ProgressRow[] {
  const byCategory = new Map<ObjectType, ListSummaryRow>();
  summary.forEach((row) => byCategory.set(row.ObjectCategory, row));

  const seen = new Set<ObjectType>();
  const rows: ProgressRow[] = [];

  const push = (category: ObjectType, vis: ListVisibilityRow | null) => {
    if (seen.has(category)) return;
    seen.add(category);

    const progress = byCategory.get(category);
    const totalSaved = progress?.TotalSaved ?? vis?.OnList ?? 0;

    rows.push({
      category,
      totalSaved,
      observed: progress?.Observed ?? totalSaved,
      completionRate: progress?.CompletionRate ?? 100,
      observable: vis ? vis.Observable : null,
      upNow: vis ? vis.UpNow : null,
    });
  };

  visibility.forEach((row) => push(row.ObjectCategory, row));
  summary.forEach((row) => push(row.ObjectCategory, null));

  return rows;
}

interface ListProgressProps {
  summary: ListSummaryRow[];
  visibility: ListVisibilityRow[];
  total: number;
  hasLocation: boolean;
  onSetLocation: () => void;
}

/**
 * Shows what is left to observe on a list and what can be seen from it
 * tonight. Both halves come back from one read transaction, so the counts
 * describe a single snapshot rather than three separate reads.
 */
export function ListProgress({
  summary, visibility, total, hasLocation, onSetLocation
}: ListProgressProps) {
  if (total === 0) return null;

  const rows = mergeRows(summary, visibility);
  const upNowTotal = visibility.reduce((sum, row) => sum + row.UpNow, 0);

  return (
    <div className="card card-border border-neutral bg-base-200 mb-6">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="card-title text-base">Progress &amp; tonight&apos;s sky</h2>
          {hasLocation && (
            <p className="text-primary font-mono text-sm">
              {`${upNowTotal} up now of ${total} saved`}
            </p>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm opacity-70">
            <Check size={14} /> Everything saved here has been observed.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <div key={row.category}
                className="flex flex-wrap items-center gap-3"
              >
                <TypeBadge
                  color={TYPE_COLORS[row.category] ?? TYPE_COLORS.Unidentified}
                  icon={TYPE_ICONS[row.category] ?? TYPE_ICONS.Unidentified}
                  objectType={row.category}
                  extraClasses="badge-sm shrink-0"
                />
                <span className="font-mono text-sm whitespace-nowrap grow-1">
                  {row.observed} observed
                  <span className="opacity-60">
                    {` of ${row.totalSaved}`}
                  </span>
                </span>
                <progress className="progress progress-warning w-24 hidden sm:block"
                  value={row.completionRate} max={100} />
                <span className="font-mono text-sm w-12 text-right">
                  {`${row.completionRate}%`}
                </span>

                {row.observable !== null && (
                  <span className="badge badge-soft badge-primary font-mono">
                    <Eye className="size-[1.2em]" />
                    {`${row.observable} observable`}
                  </span>
                )}
                {row.upNow !== null && (
                  <span className="badge badge-soft badge-warning font-mono">
                    <Telescope className="size-[1.2em]" />
                    {`${row.upNow} up now`}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!hasLocation && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm opacity-70">
              Add coordinates to this list to see what is above the horizon
              right now.
            </p>
            <button onClick={onSetLocation} className="btn btn-soft btn-xs gap-1">
              <MapPin size={13} /> Set a location
            </button>
          </div>
        )}

        <p className="text-xs font-mono text-neutral-content">
          Counted together in one REPEATABLE READ transaction.
        </p>
      </div>
    </div>
  );
}
