"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Company } from "@/lib/types";

interface FilterSidebarProps {
  companies: Company[];
  onFilterChange: (filtered: Company[]) => void;
}

/* ─── SVG Icons ──────────────────────────────────────────────────── */

function HiringIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12l2.5 2.5L16 9"/>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

export default function FilterSidebar({
  companies,
  onFilterChange,
}: FilterSidebarProps) {
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(
    new Set()
  );
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(
    new Set()
  );
  const [hiringOnly, setHiringOnly] = useState(false);
  const [topOnly, setTopOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  // Extract unique batches and industries
  const batches = [
    ...new Set(companies.map((c) => c.batch).filter(Boolean) as string[]),
  ].sort((a, b) => {
    // Sort by year descending
    const yearA = parseInt(a.match(/\d{4}/)?.[0] || "0");
    const yearB = parseInt(b.match(/\d{4}/)?.[0] || "0");
    return yearB - yearA;
  });

  const industries = [
    ...new Set(companies.flatMap((c) => c.industries).filter(Boolean)),
  ].sort();

  const applyFilters = (
    batchSet: Set<string>,
    industrySet: Set<string>,
    hiring: boolean,
    top: boolean,
    query: string
  ) => {
    let filtered = [...companies];

    if (batchSet.size > 0) {
      filtered = filtered.filter((c) => c.batch && batchSet.has(c.batch));
    }

    if (industrySet.size > 0) {
      filtered = filtered.filter((c) =>
        c.industries.some((ind) => industrySet.has(ind))
      );
    }

    if (hiring) {
      filtered = filtered.filter((c) => c.is_hiring);
    }

    if (top) {
      filtered = filtered.filter((c) => c.is_top_company);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q) ||
          c.location?.toLowerCase().includes(q)
      );
    }

    onFilterChange(filtered);
  };

  const toggleBatch = (batch: string) => {
    const next = new Set(selectedBatches);
    if (next.has(batch)) next.delete(batch);
    else next.add(batch);
    setSelectedBatches(next);
    applyFilters(next, selectedIndustries, hiringOnly, topOnly, searchQuery);
  };

  const toggleIndustry = (industry: string) => {
    const next = new Set(selectedIndustries);
    if (next.has(industry)) next.delete(industry);
    else next.add(industry);
    setSelectedIndustries(next);
    applyFilters(selectedBatches, next, hiringOnly, topOnly, searchQuery);
  };

  const toggleHiring = () => {
    const next = !hiringOnly;
    setHiringOnly(next);
    applyFilters(selectedBatches, selectedIndustries, next, topOnly, searchQuery);
  };

  const toggleTop = () => {
    const next = !topOnly;
    setTopOnly(next);
    applyFilters(selectedBatches, selectedIndustries, hiringOnly, next, searchQuery);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(selectedBatches, selectedIndustries, hiringOnly, topOnly, query);
  };

  const clearAll = () => {
    setSelectedBatches(new Set());
    setSelectedIndustries(new Set());
    setHiringOnly(false);
    setTopOnly(false);
    setSearchQuery("");
    onFilterChange(companies);
  };

  const hasActiveFilters =
    selectedBatches.size > 0 ||
    selectedIndustries.size > 0 ||
    hiringOnly ||
    topOnly ||
    searchQuery.trim() !== "";

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#f97316] text-white shadow-lg shadow-orange-500/20 flex items-center justify-center hover:bg-[#ea580c] transition-all duration-200"
        id="filter-toggle"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {hasActiveFilters && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
            !
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="w-60 flex-shrink-0 sticky top-[120px] self-start hidden lg:block"
            id="filter-sidebar"
          >
            <div className="bg-[#111111] border border-white/[0.06] rounded-xl p-4 space-y-5">
              {/* Search */}
              <div>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3f3f46]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search companies..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0a0a0a] border border-white/[0.06] rounded-lg text-[13px] text-[#e4e4e7] placeholder-[#3f3f46] focus:outline-none focus:border-[#f97316]/40 focus:ring-1 focus:ring-[#f97316]/10 transition-all duration-200 font-light"
                    id="search-input"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <ToggleFilter
                  id="hiring-toggle"
                  label="Hiring only"
                  icon={<HiringIcon />}
                  checked={hiringOnly}
                  onChange={toggleHiring}
                />
                <ToggleFilter
                  id="top-toggle"
                  label="Top companies"
                  icon={<StarIcon />}
                  checked={topOnly}
                  onChange={toggleTop}
                />
              </div>

              {/* Batch multi-select */}
              <FilterSection title="Batch" count={selectedBatches.size}>
                <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                  {batches.slice(0, 12).map((batch) => (
                    <CheckboxFilter
                      key={batch}
                      label={batch}
                      checked={selectedBatches.has(batch)}
                      onChange={() => toggleBatch(batch)}
                    />
                  ))}
                </div>
              </FilterSection>

              {/* Industry multi-select */}
              <FilterSection title="Industry" count={selectedIndustries.size}>
                <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                  {industries.slice(0, 15).map((ind) => (
                    <CheckboxFilter
                      key={ind}
                      label={ind}
                      checked={selectedIndustries.has(ind)}
                      onChange={() => toggleIndustry(ind)}
                    />
                  ))}
                </div>
              </FilterSection>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="w-full py-2 text-[11px] font-medium text-[#f97316]/80 hover:text-[#f97316] transition-colors duration-200 tracking-wide"
                  id="clear-filters"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function FilterSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-[#52525b] uppercase tracking-[0.08em]">
          {title}
        </h4>
        {count > 0 && (
          <span className="text-[10px] font-medium text-[#f97316]/80 bg-[#f97316]/8 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleFilter({
  id,
  label,
  icon,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      id={id}
      onClick={onChange}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all duration-200 ${
        checked
          ? "bg-[#f97316]/8 border border-[#f97316]/20 text-[#e4e4e7]"
          : "bg-[#0a0a0a] border border-white/[0.06] text-[#71717a] hover:border-white/[0.1]"
      }`}
    >
      <span className="flex items-center gap-2 font-light">
        {icon}
        {label}
      </span>
      <div
        className={`w-8 h-4.5 rounded-full transition-colors duration-200 relative ${
          checked ? "bg-[#f97316]" : "bg-[#27272a]"
        }`}
      >
        <div
          className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}

function CheckboxFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-all duration-200 ${
        checked
          ? "text-[#e4e4e7] bg-[#f97316]/8"
          : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/[0.03]"
      }`}
    >
      <div
        className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
          checked
            ? "bg-[#f97316] border-[#f97316]"
            : "border-white/[0.1] bg-transparent"
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="truncate font-light">{label}</span>
    </button>
  );
}
