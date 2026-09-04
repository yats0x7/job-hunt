"use client";

import { useCallback, useMemo, useState } from "react";
import { Company } from "@/lib/types";

export interface FilterOption {
  value: string;
  count: number;
}

export interface CompanyFilters {
  query: string;
  topOnly: boolean;
  selectedBatches: Set<string>;
  selectedIndustries: Set<string>;
  batchOptions: FilterOption[];
  industryOptions: FilterOption[];
  filtered: Company[];
  activeCount: number;
  hasActiveFilters: boolean;
  setQuery: (query: string) => void;
  toggleTop: () => void;
  toggleBatch: (batch: string) => void;
  toggleIndustry: (industry: string) => void;
  clearAll: () => void;
}

function toggled(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function batchYear(batch: string): number {
  return parseInt(batch.match(/\d{4}/)?.[0] ?? "0", 10);
}

/**
 * Owns every piece of filter state for the discovery page so the sidebar,
 * the mobile drawer and the results header can all read and update it.
 */
export function useCompanyFilters(companies: Company[]): CompanyFilters {
  const valid = useMemo(
    () => (Array.isArray(companies) ? companies : []),
    [companies]
  );

  const [query, setQuery] = useState("");
  const [topOnly, setTopOnly] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(
    () => new Set()
  );

  const batchOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const c of valid) {
      if (c?.batch) counts.set(c.batch, (counts.get(c.batch) ?? 0) + 1);
    }
    return [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort(
        (a, b) =>
          batchYear(b.value) - batchYear(a.value) || a.value.localeCompare(b.value)
      );
  }, [valid]);

  const industryOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const c of valid) {
      for (const industry of c?.industries ?? []) {
        if (industry) counts.set(industry, (counts.get(industry) ?? 0) + 1);
      }
    }
    return [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }, [valid]);

  const filtered = useMemo(() => {
    let list = valid;

    if (selectedBatches.size > 0) {
      list = list.filter((c) => c?.batch && selectedBatches.has(c.batch));
    }

    if (selectedIndustries.size > 0) {
      list = list.filter((c) =>
        (c?.industries ?? []).some((industry) => selectedIndustries.has(industry))
      );
    }

    if (topOnly) {
      list = list.filter((c) => Boolean(c?.is_top_company));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c?.name?.toLowerCase().includes(q) ||
          c?.description?.toLowerCase().includes(q) ||
          c?.industry?.toLowerCase().includes(q) ||
          c?.location?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [valid, selectedBatches, selectedIndustries, topOnly, query]);

  const toggleTop = useCallback(() => setTopOnly((v) => !v), []);
  const toggleBatch = useCallback(
    (batch: string) => setSelectedBatches((s) => toggled(s, batch)),
    []
  );
  const toggleIndustry = useCallback(
    (industry: string) => setSelectedIndustries((s) => toggled(s, industry)),
    []
  );
  const clearAll = useCallback(() => {
    setQuery("");
    setTopOnly(false);
    setSelectedBatches(new Set());
    setSelectedIndustries(new Set());
  }, []);

  const activeCount =
    selectedBatches.size +
    selectedIndustries.size +
    (topOnly ? 1 : 0) +
    (query.trim() ? 1 : 0);

  return {
    query,
    topOnly,
    selectedBatches,
    selectedIndustries,
    batchOptions,
    industryOptions,
    filtered,
    activeCount,
    hasActiveFilters: activeCount > 0,
    setQuery,
    toggleTop,
    toggleBatch,
    toggleIndustry,
    clearAll,
  };
}
