"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CompanyFilters, FilterOption } from "@/lib/useCompanyFilters";
import { plural } from "@/lib/format";
import { CheckIcon, CloseIcon, FilterIcon, SearchIcon, StarIcon } from "./Icons";

interface FilterSidebarProps {
  filters: CompanyFilters;
  resultCount: number;
}

export default function FilterSidebar({ filters, resultCount }: FilterSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const close = () => setDrawerOpen(false);

  // Lock page scroll and support Escape while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        id="filter-sidebar"
        className="hidden lg:block w-64 shrink-0 sticky top-6 self-start"
        aria-label="Filters"
      >
        <div className="rounded-2xl bg-surface border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
              Filters
            </span>
            {filters.hasActiveFilters && (
              <button
                onClick={filters.clearAll}
                className="text-[11px] font-medium text-accent/90 hover:text-accent"
                id="clear-filters"
              >
                Clear all
              </button>
            )}
          </div>
          <FilterPanel filters={filters} />
        </div>
      </aside>

      {/* Mobile trigger */}
      <button
        id="filter-toggle"
        onClick={() => setDrawerOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        className="lg:hidden fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-11 pl-4 pr-4 rounded-full
          bg-accent text-white text-[13px] font-medium
          shadow-[0_10px_30px_-8px_rgba(249,115,22,0.7)] hover:bg-orange-500 active:scale-95"
      >
        <FilterIcon size={16} />
        Filters
        {filters.activeCount > 0 && (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-white/25 text-[11px] font-semibold flex items-center justify-center tabular-nums">
            {filters.activeCount}
          </span>
        )}
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="lg:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[88dvh]
                rounded-t-3xl bg-surface border-t border-border shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
            >
              <div className="relative flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
                <span className="absolute left-1/2 top-2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />
                <h2 className="text-sm font-semibold text-foreground">Filters</h2>
                <div className="flex items-center gap-3">
                  {filters.hasActiveFilters && (
                    <button
                      onClick={filters.clearAll}
                      className="text-[12px] font-medium text-accent/90 hover:text-accent"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    onClick={close}
                    aria-label="Close filters"
                    className="w-8 h-8 rounded-full bg-white/[0.05] text-muted hover:text-foreground hover:bg-white/[0.1] flex items-center justify-center"
                  >
                    <CloseIcon size={15} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <FilterPanel filters={filters} />
              </div>

              <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border">
                <button
                  onClick={close}
                  className="w-full h-11 rounded-xl bg-accent text-white text-sm font-medium hover:bg-orange-500 active:scale-[0.99] tabular-nums"
                >
                  Show {resultCount.toLocaleString()} {plural(resultCount, "company", "companies")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Panel (shared by sidebar and drawer) ───────────────────────── */

function FilterPanel({ filters }: { filters: CompanyFilters }) {
  return (
    <div className="space-y-6">
      <SearchInput value={filters.query} onChange={filters.setQuery} />

      <ToggleFilter
        id="top-toggle"
        label="Top companies"
        hint="YC’s highest-valued"
        icon={<StarIcon size={14} className="text-amber-400" />}
        checked={filters.topOnly}
        onChange={filters.toggleTop}
      />

      {filters.batchOptions.length > 0 && (
        <OptionGroup
          title="Batch"
          options={filters.batchOptions}
          selected={filters.selectedBatches}
          onToggle={filters.toggleBatch}
        />
      )}

      {filters.industryOptions.length > 0 && (
        <OptionGroup
          title="Industry"
          options={filters.industryOptions}
          selected={filters.selectedIndustries}
          onToggle={filters.toggleIndustry}
        />
      )}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <SearchIcon
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
      />
      <input
        id="search-input"
        type="search"
        placeholder="Search companies…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="w-full h-10 pl-9 pr-9 bg-background border border-border rounded-xl text-[13px] text-foreground
          placeholder:text-faint
          focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15
          [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-faint hover:text-foreground hover:bg-white/[0.08] flex items-center justify-center"
        >
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  );
}

function ToggleFilter({
  id,
  label,
  hint,
  icon,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left ${
        checked
          ? "bg-accent/10 border-accent/30"
          : "bg-background border-border hover:border-border-strong"
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        {icon}
        <span className="flex flex-col min-w-0">
          <span className={`text-[13px] leading-tight ${checked ? "text-foreground" : "text-muted"}`}>
            {label}
          </span>
          {hint && <span className="text-[11px] text-faint leading-tight mt-0.5">{hint}</span>}
        </span>
      </span>
      <span
        className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-accent" : "bg-white/[0.12]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

const INITIAL_VISIBLE = 8;

function OptionGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = options.length > INITIAL_VISIBLE;
  const visible = expanded
    ? options
    : options.filter((o, i) => i < INITIAL_VISIBLE || selected.has(o.value));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-semibold text-subtle uppercase tracking-[0.1em]">
          {title}
        </h4>
        {selected.size > 0 && (
          <span className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 px-1.5 py-px rounded-full tabular-nums">
            {selected.size}
          </span>
        )}
      </div>

      <div className={`space-y-px -mx-1 ${expanded ? "max-h-72 overflow-y-auto pr-1" : ""}`}>
        {visible.map((option) => (
          <CheckboxOption
            key={option.value}
            option={option}
            checked={selected.has(option.value)}
            onChange={() => onToggle(option.value)}
          />
        ))}
      </div>

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 px-1 text-[11px] font-medium text-subtle hover:text-accent"
        >
          {expanded ? "Show fewer" : `Show all ${options.length}`}
        </button>
      )}
    </div>
  );
}

function CheckboxOption({
  option,
  checked,
  onChange,
}: {
  option: FilterOption;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[12.5px] text-left ${
        checked
          ? "text-foreground bg-accent/10"
          : "text-muted hover:text-foreground hover:bg-white/[0.04]"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-[5px] border shrink-0 flex items-center justify-center transition-colors duration-150 ${
          checked ? "bg-accent border-accent" : "border-white/[0.16] bg-transparent"
        }`}
      >
        {checked && <CheckIcon size={10} className="text-white" />}
      </span>
      <span className="truncate flex-1">{option.value}</span>
      <span className={`text-[11px] tabular-nums ${checked ? "text-orange-300" : "text-faint"}`}>
        {option.count}
      </span>
    </button>
  );
}
