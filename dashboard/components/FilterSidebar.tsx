"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Company } from "@/lib/types";

interface FilterSidebarProps {
  companies: Company[];
  onFilterChange: (filtered: Company[]) => void;
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
        className="lg:hidden fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#f97316] text-white shadow-lg shadow-orange-500/25 flex items-center justify-center hover:bg-[#ea580c] transition-colors"
        id="filter-toggle"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            className="w-64 flex-shrink-0 sticky top-[120px] self-start hidden lg:block"
            id="filter-sidebar"
          >
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 space-y-5">
              {/* Search */}
              <div>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525b]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
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
                    className="w-full pl-9 pr-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#f97316]/50 focus:ring-1 focus:ring-[#f97316]/20 transition-all"
                    id="search-input"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <ToggleFilter
                  id="hiring-toggle"
                  label="Hiring only"
                  emoji="🟢"
                  checked={hiringOnly}
                  onChange={toggleHiring}
                />
                <ToggleFilter
                  id="top-toggle"
                  label="Top companies"
                  emoji="⭐"
                  checked={topOnly}
                  onChange={toggleTop}
                />
              </div>

              {/* Batch multi-select */}
              <FilterSection title="Batch" count={selectedBatches.size}>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
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
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
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
                  className="w-full py-2 text-xs font-medium text-[#f97316] hover:text-[#fb923c] transition-colors"
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
        <h4 className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">
          {title}
        </h4>
        {count > 0 && (
          <span className="text-[10px] font-medium text-[#f97316] bg-[#f97316]/10 px-1.5 py-0.5 rounded-full">
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
  emoji,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  emoji: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      id={id}
      onClick={onChange}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
        checked
          ? "bg-[#f97316]/10 border border-[#f97316]/30 text-[#fafafa]"
          : "bg-[#09090b] border border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46]"
      }`}
    >
      <span className="flex items-center gap-2">
        <span>{emoji}</span>
        {label}
      </span>
      <div
        className={`w-8 h-4.5 rounded-full transition-colors duration-200 relative ${
          checked ? "bg-[#f97316]" : "bg-[#3f3f46]"
        }`}
      >
        <div
          className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
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
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-150 ${
        checked
          ? "text-[#fafafa] bg-[#f97316]/10"
          : "text-[#a1a1aa] hover:text-[#d4d4d8] hover:bg-[#27272a]/50"
      }`}
    >
      <div
        className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
          checked
            ? "bg-[#f97316] border-[#f97316]"
            : "border-[#3f3f46] bg-transparent"
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="truncate">{label}</span>
    </button>
  );
}
