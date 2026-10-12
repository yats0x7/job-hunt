"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { CompanySummary, DataMetadata } from "@/lib/types";
import { useCompanyFilters, type CompanyFilters } from "@/lib/useCompanyFilters";
import { formatDate, plural } from "@/lib/format";
import StatsBar from "@/components/StatsBar";
import FilterSidebar from "@/components/FilterSidebar";
import CompanyCard from "@/components/CompanyCard";
import { CloseIcon, RocketIcon, SearchIcon } from "@/components/Icons";

/** Cards drawn per step. Divisible by 2 and 3 so every grid row is full. */
const PAGE_SIZE = 60;

export default function DashboardClient({
  companies,
  metadata,
}: {
  companies: CompanySummary[];
  metadata: DataMetadata;
}) {
  const filters = useCompanyFilters(companies);
  const { filtered } = filters;

  // Draw the list a page at a time. Start over whenever the filters change.
  const [shown, setShown] = useState({ list: filtered, count: PAGE_SIZE });
  if (shown.list !== filtered) {
    setShown({ list: filtered, count: PAGE_SIZE });
  }
  const visible = filtered.slice(0, shown.count);
  const remaining = filtered.length - visible.length;
  const showMore = () =>
    setShown((s) => ({ list: s.list, count: s.count + PAGE_SIZE }));

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-accent to-accent-muted shadow-[0_8px_24px_-8px_rgba(249,115,22,0.8)] flex items-center justify-center text-white">
                <RocketIcon size={19} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-foreground tracking-tight leading-tight">
                  Startup Discovery
                </h1>
                <p className="text-[12px] text-subtle mt-0.5 truncate">
                  YC-backed companies · Live hiring data · Founder insights
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-border bg-surface text-[12px] text-muted">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-success opacity-50 animate-ping" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-success" />
                </span>
                Updated {formatDate(metadata?.last_updated)}
              </span>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="pt-6 sm:pt-8">
          <StatsBar metadata={metadata} companies={companies} />
        </div>

        {/* Main Content */}
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-10 pb-24 lg:pb-10">
          <div className="flex gap-8 items-start">
            <FilterSidebar filters={filters} resultCount={filtered.length} />

            <div className="flex-1 min-w-0">
              <ResultsHeader filters={filters} total={companies.length} />

              {filtered.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visible.map((company, i) => (
                      <CompanyCard
                        key={company.slug}
                        company={company}
                        index={i % PAGE_SIZE}
                      />
                    ))}
                  </div>
                  <ListFooter
                    shown={visible.length}
                    total={filtered.length}
                    nextCount={Math.min(PAGE_SIZE, remaining)}
                    onShowMore={showMore}
                  />
                </>
              ) : (
                <EmptyState onReset={filters.clearAll} />
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-8 mt-auto">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-faint">
            <span>Startup Discovery Platform</span>
            <span>Data sourced from public APIs · Refreshed weekly</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

/* ─── Results header with active-filter chips ────────────────────── */

function ResultsHeader({ filters, total }: { filters: CompanyFilters; total: number }) {
  const count = filters.filtered.length;
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.query.trim()) {
    chips.push({
      key: "query",
      label: `“${filters.query.trim()}”`,
      onRemove: () => filters.setQuery(""),
    });
  }
  if (filters.topOnly) {
    chips.push({ key: "top", label: "Top companies", onRemove: filters.toggleTop });
  }
  for (const batch of filters.selectedBatches) {
    chips.push({ key: `batch:${batch}`, label: batch, onRemove: () => filters.toggleBatch(batch) });
  }
  for (const industry of filters.selectedIndustries) {
    chips.push({
      key: `industry:${industry}`,
      label: industry,
      onRemove: () => filters.toggleIndustry(industry),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      <p className="text-[13px] text-subtle tabular-nums" aria-live="polite">
        <span className="text-foreground font-semibold">{count.toLocaleString()}</span>{" "}
        {plural(count, "company", "companies")}
        {count !== total && <span className="text-faint"> of {total.toLocaleString()}</span>}
      </p>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.label}`}
              className="group inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-full text-[11px] font-medium
                bg-accent/10 text-orange-200 border border-accent/25 hover:bg-accent/20 hover:border-accent/40"
            >
              {chip.label}
              <CloseIcon size={10} className="text-orange-300/70 group-hover:text-orange-200" />
            </button>
          ))}
          <button
            type="button"
            onClick={filters.clearAll}
            className="h-6 px-2 text-[11px] font-medium text-subtle hover:text-accent"
          >
            Clear all
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ─── List footer: progress, and more cards on scroll or click ────── */

function ListFooter({
  shown,
  total,
  nextCount,
  onShowMore,
}: {
  shown: number;
  total: number;
  nextCount: number;
  onShowMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const done = nextCount <= 0;

  // Load the next page shortly before the reader reaches the end. The button
  // below does the same thing for keyboards and browsers without the observer.
  useEffect(() => {
    const node = sentinel.current;
    if (done || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onShowMore();
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, shown, onShowMore]);

  if (total <= PAGE_SIZE) return null;

  return (
    <div ref={sentinel} className="mt-8 flex flex-col items-center gap-3">
      <p className="text-[12px] text-muted tabular-nums">
        Showing {shown.toLocaleString()} of {total.toLocaleString()}
      </p>
      {!done && (
        <button
          type="button"
          onClick={onShowMore}
          className="h-9 px-4 rounded-full text-[12px] font-medium bg-white/[0.05] text-foreground border border-border hover:border-border-strong hover:bg-white/[0.08]"
        >
          Show {nextCount.toLocaleString()} more
        </button>
      )}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────── */

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-border">
      <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5 text-faint">
        <SearchIcon size={22} />
      </div>
      <h3 className="text-sm font-medium text-muted mb-1">No companies match your filters</h3>
      <p className="text-xs text-faint mb-5">Try a broader search or remove a filter.</p>
      <button
        type="button"
        onClick={onReset}
        className="h-9 px-4 rounded-full text-[12px] font-medium bg-white/[0.05] text-foreground border border-border hover:border-border-strong hover:bg-white/[0.08]"
      >
        Reset filters
      </button>
    </div>
  );
}
