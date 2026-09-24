import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridOption } from "@/lib/gridPaste";

export interface ComboboxProps {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  options: GridOption[];
  placeholder?: string;
  noResultsLabel: string;
  className?: string;
  invalid?: boolean;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

/**
 * A text-input-backed searchable dropdown — unlike SelectTrigger (a button,
 * not an editable field), this is a real <input> so it supports native
 * copy/paste, which the line-item grids rely on for pasting from Excel.
 */
export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  { value, onValueChange, options, placeholder, noResultsLabel, className, invalid, onPaste },
  forwardedRef,
) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.code?.toLowerCase().includes(q));
  }, [options, query]);

  React.useEffect(() => {
    setHighlighted(0);
  }, [filtered]);

  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function selectOption(o: GridOption | undefined) {
    onValueChange(o?.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[highlighted]) {
        e.preventDefault();
        selectOption(filtered[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex h-9 w-full items-center gap-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:border-primary",
          invalid && "border-error focus-within:ring-error",
          className,
        )}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            // A grid paste resolves the value directly against form state
            // (bypassing this component's own filter/select flow), so close
            // the now-stale dropdown ourselves once it's handled.
            onPaste?.(e);
            setOpen(false);
            setQuery("");
          }}
          placeholder={selected ? undefined : placeholder}
          className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-subtle"
        />
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </div>
      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full min-w-[12rem] overflow-auto rounded-md border border-border bg-surface-raised p-1 shadow-lg"
        >
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-subtle">{noResultsLabel}</div>}
          {filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(o);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm",
                i === highlighted && "bg-primary-subtle text-primary",
              )}
            >
              <Check className={cn("size-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
