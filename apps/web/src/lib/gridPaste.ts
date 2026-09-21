// Supports pasting a block of cells copied from Excel/Sheets into the
// editable line-item grids (journal entries, sales/purchase invoices).
import type { ClipboardEvent } from "react";

/** Splits pasted clipboard text into a 2D grid: rows by newline, cells by tab. */
export function parseClipboardText(text: string): string[][] {
  const rows = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  // Copying whole rows from a spreadsheet usually ends with a trailing
  // newline — drop the resulting empty last row.
  if (rows.length > 1 && rows[rows.length - 1] === "") rows.pop();
  return rows.map((row) => row.split("\t"));
}

export interface GridOption {
  value: string;
  label: string;
  code?: string;
}

/** Resolves pasted text (an account/item code, or its name) to an option's value. */
export function resolveOptionId(options: GridOption[], text: string): string | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  const byCode = options.find((o) => o.code && o.code.toLowerCase() === t);
  if (byCode) return byCode.value;
  const byLabel = options.find((o) => o.label.toLowerCase() === t);
  if (byLabel) return byLabel.value;
  return options.find((o) => o.label.toLowerCase().includes(t))?.value;
}

export interface PasteGridColumn {
  key: string;
  resolve: (rawText: string) => unknown;
}

/**
 * Builds a paste handler for one of the editable line-item grids. Pastes
 * starting anywhere in the grid land at that row/column and spill into as
 * many rows/columns as the pasted block needs, appending new rows as
 * necessary — matching how pasting a block into Excel works.
 */
export function createGridPasteHandler(params: {
  columns: PasteGridColumn[];
  linesPath: string;
  currentRowCount: number;
  appendRow: () => void;
  setValue: (path: string, value: unknown) => void;
}) {
  return function handlePaste(e: ClipboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const grid = parseClipboardText(text);
    let knownRowCount = params.currentRowCount;
    grid.forEach((rowCells, rOffset) => {
      const targetRow = rowIndex + rOffset;
      while (knownRowCount <= targetRow) {
        params.appendRow();
        knownRowCount++;
      }
      rowCells.forEach((cellText, cOffset) => {
        const column = params.columns[colIndex + cOffset];
        if (!column) return;
        params.setValue(`${params.linesPath}.${targetRow}.${column.key}`, column.resolve(cellText));
      });
    });
  };
}
