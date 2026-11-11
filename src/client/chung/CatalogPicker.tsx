"use client";

import { useMemo, useState } from "react";
import { searchCatalog } from "@/shared/match";
import type { CatalogItem, VietTat } from "@/shared/types";

export function describeItem(item: CatalogItem): string {
  return [item.ten, item.ham_luong, item.dang_bao_che].filter(Boolean).join(" · ");
}

interface Props {
  value: string;
  label: string;
  className: string;
  catalog: CatalogItem[];
  vietTat: VietTat;
  onPick: (item: CatalogItem) => void;
  onClear: () => void;
}

/** Ô chọn mã: gõ để tìm mờ theo tên, tên khác, hoạt chất hoặc mã */
export function CatalogPicker({ value, label, className, catalog, vietTat, onPick, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const results = useMemo(
    () => (open ? searchCatalog(query, catalog, vietTat, 8).map((entry) => entry.item) : []),
    [open, query, catalog, vietTat],
  );

  function pick(item: CatalogItem) {
    onPick(item);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter" && results[cursor]) {
      event.preventDefault();
      pick(results[cursor]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        aria-label={label}
        className={`${className} pr-7`}
        placeholder="Gõ tên để tìm…"
        value={open ? query : value}
        onChange={(event) => {
          setQuery(event.target.value);
          setCursor(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {value && !open && (
        <button
          type="button"
          aria-label={`Xóa ${label}`}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted hover:text-ink"
          onClick={onClear}
        >
          ×
        </button>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-80 max-w-[85vw] overflow-auto rounded border border-gray-300 bg-white shadow-lg">
          {results.map((item, index) => (
            <li key={item.ma}>
              <button
                type="button"
                // Dùng onMouseDown để chọn được trước khi ô nhập mất focus
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(item);
                }}
                className={`block w-full px-2.5 py-1.5 text-left text-sm ${index === cursor ? "bg-soft" : "hover:bg-soft"}`}
              >
                <span className="font-medium text-navy">{item.ma}</span>{" "}
                <span>{describeItem(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
