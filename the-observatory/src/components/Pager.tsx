import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";

// Classes common to all pager buttons
const PAGER_BUTTON_CLASSES = "btn btn-outline btn-primary btn-lg btn-square";

interface PagerProps {
  currentPage: number;
  numberOfPages: number;
  onSetCurrentPage: (p: number) => void;
}

/**
 * A pager for viewing Celestial Object results on the Explore page.
 */
export function Pager({
  currentPage, numberOfPages, onSetCurrentPage
}: PagerProps) {

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onSetCurrentPage(1)}
        disabled={currentPage === 1}
        className={`${PAGER_BUTTON_CLASSES} hidden md:inline-flex`}
      >
        <ChevronsLeft className="size-[1.2em]" />
        <span className="sr-only">First page</span>
      </button>
      <button
        onClick={() => onSetCurrentPage(currentPage - 1)}
        disabled={currentPage === 1}
        className={PAGER_BUTTON_CLASSES}
      >
        <ChevronLeft className="size-[1.2em]" />
        <span className="sr-only">Previous page</span>
      </button>
      <label htmlFor="page-number">
        Page
      </label>
      <input
        id="page-number"
        type="number"
        value={currentPage}
        // Backspacing empties the box, and parseInt("") is NaN, which the
        // input refuses as a value. Ignore it and wait for a real number.
        onChange={(e) => {
          const page = parseInt(e.target.value);
          if (!Number.isNaN(page)) onSetCurrentPage(page);
        }}
        className="input validator"
        min="1"
        max={numberOfPages}
        title={`Must be between 1 and ${numberOfPages}`}
      />
      <span className="text-nowrap">{`of ${numberOfPages}`}</span>
      <button
        onClick={() => onSetCurrentPage(currentPage + 1)}
        disabled={currentPage === numberOfPages}
        className={PAGER_BUTTON_CLASSES}
      >
        <ChevronRight className="size-[1.2em]" />
        <span className="sr-only">Next page</span>
      </button>
      <button
        onClick={() => onSetCurrentPage(numberOfPages)}
        disabled={currentPage === numberOfPages}
        className={`${PAGER_BUTTON_CLASSES} hidden md:inline-flex`}
      >
        <ChevronsRight className="size-[1.2em]" />
        <span className="sr-only">Last page</span>
      </button>
    </div>
  );
}
