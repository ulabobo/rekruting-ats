"use client";

import React, { useState } from "react";
import { Check, ChevronDown, Filter, X } from "lucide-react";
import { Language } from "@/types/ats";

export interface FilterState {
  branches: string[];
  positions: string[];
  sources: string[];
  onlyDuplicates: boolean;
  onlySlaBreach: boolean;
}

export default function FilterPopover({
  lang,
  availableBranches,
  availablePositions,
  value,
  onChange,
}: {
  lang: Language;
  availableBranches: string[];
  availablePositions: string[];
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(value);

  const activeCount =
    value.branches.length +
    value.positions.length +
    value.sources.length +
    (value.onlyDuplicates ? 1 : 0) +
    (value.onlySlaBreach ? 1 : 0);

  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const allSources = ["Telegram bot", "OLX", "hh.uz", "Sayt", "Tavsiya", "Ichki nomzod"];

  const handleOpen = () => {
    setDraft(value);
    setOpen((o) => !o);
  };

  const handleReset = () => {
    const empty: FilterState = {
      branches: [],
      positions: [],
      sources: [],
      onlyDuplicates: false,
      onlySlaBreach: false,
    };
    setDraft(empty);
    onChange(empty);
    setOpen(false);
  };

  const handleSave = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition hover:border-[#5865f2]/40"
        >
          <Filter className="h-3.5 w-3.5 text-slate-600" />
          <span>{lang === "ru" ? "Фильтры" : "Filtrlar"}</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1e293b] px-1.5 text-[10px] font-extrabold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {/* Active filter chips inline preview */}
        {value.branches.map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1 rounded-full bg-[#4f7df3] px-2.5 py-1 text-[11px] font-semibold text-white"
          >
            {b}
            <button
              onClick={() =>
                onChange({ ...value, branches: value.branches.filter((x) => x !== b) })
              }
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.positions.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full bg-[#4f7df3] px-2.5 py-1 text-[11px] font-semibold text-white"
          >
            {p}
            <button
              onClick={() =>
                onChange({ ...value, positions: value.positions.filter((x) => x !== p) })
              }
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-100 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
          {/* Small top pointer */}
          <div className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 border-l border-t border-slate-100 bg-white" />

          <div className="space-y-4 p-5 text-xs">
            {/* Filiallar */}
            <div>
              <p className="mb-2 font-bold text-slate-800">
                {lang === "ru" ? "Филиалы" : "Filiallar"}
              </p>
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                {availableBranches.length === 0 ? (
                  <span className="text-[11px] text-slate-400">—</span>
                ) : (
                  availableBranches.map((b) => {
                    const selected = draft.branches.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, branches: toggleItem(draft.branches, b) })
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                          selected
                            ? "bg-[#4f7df3] text-white shadow-2xs"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {b}
                        {selected && <X className="h-3 w-3" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Lavozimlar */}
            <div>
              <p className="mb-2 font-bold text-slate-800">
                {lang === "ru" ? "Должности" : "Lavozimlar"}
              </p>
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                {availablePositions.length === 0 ? (
                  <span className="text-[11px] text-slate-400">—</span>
                ) : (
                  availablePositions.map((p) => {
                    const selected = draft.positions.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, positions: toggleItem(draft.positions, p) })
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                          selected
                            ? "bg-[#4f7df3] text-white shadow-2xs"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                        {selected && <X className="h-3 w-3" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Manba & Holat Checkboxes */}
            <div>
              <p className="mb-2 font-bold text-slate-800">
                {lang === "ru" ? "Источник и Статус" : "Manba va Holat"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allSources.map((src) => {
                  const checked = draft.sources.includes(src);
                  return (
                    <label
                      key={src}
                      onClick={() =>
                        setDraft({ ...draft, sources: toggleItem(draft.sources, src) })
                      }
                      className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700"
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                          checked
                            ? "border-[#4f7df3] bg-[#4f7df3] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      {src}
                    </label>
                  );
                })}

                <label
                  onClick={() =>
                    setDraft({ ...draft, onlyDuplicates: !draft.onlyDuplicates })
                  }
                  className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                      draft.onlyDuplicates
                        ? "border-[#4f7df3] bg-[#4f7df3] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {draft.onlyDuplicates && <Check className="h-3 w-3" />}
                  </span>
                  {lang === "ru" ? "Повторные" : "Qayta murojaat"}
                </label>

                <label
                  onClick={() =>
                    setDraft({ ...draft, onlySlaBreach: !draft.onlySlaBreach })
                  }
                  className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                      draft.onlySlaBreach
                        ? "border-[#4f7df3] bg-[#4f7df3] text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {draft.onlySlaBreach && <Check className="h-3 w-3" />}
                  </span>
                  {lang === "ru" ? "Просроченные" : "Muddati o'tgan"}
                </label>
              </div>
            </div>
          </div>

          {/* Footer (Rasmdagidek Cancel + Save) */}
          <div className="flex items-center justify-center gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70"
            >
              {lang === "ru" ? "Сбросить" : "Tozalash"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-[#2b3a67] px-6 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1e294b]"
            >
              {lang === "ru" ? "Применить" : "Saqlash"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
