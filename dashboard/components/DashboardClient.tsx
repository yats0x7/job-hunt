"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Company, DataMetadata } from "@/lib/types";
import StatsBar from "@/components/StatsBar";
import FilterSidebar from "@/components/FilterSidebar";
import CompanyCard from "@/components/CompanyCard";

export default function DashboardClient({ companies, metadata }: { companies: Company[], metadata: DataMetadata }) {
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>(
    companies
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f97316] to-[#c2410c] flex items-center justify-center">
              <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#e4e4e7] tracking-tight leading-tight">
                Startup Discovery
              </h1>
              <p className="text-[11px] text-[#52525b] mt-0.5 font-light tracking-wide">
                Explore YC-backed companies · Live hiring data · Founder insights
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar metadata={metadata} companies={companies} />

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-10">
        <div className="flex gap-8">
          {/* Sidebar */}
          <FilterSidebar
            companies={companies}
            onFilterChange={setFilteredCompanies}
          />

          {/* Company Grid */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-between mb-8"
            >
              <p className="text-[13px] text-[#52525b] font-light">
                <span className="text-[#a1a1aa] font-medium">
                  {filteredCompanies.length}
                </span>{" "}
                {filteredCompanies.length === 1 ? "company" : "companies"}
                {filteredCompanies.length !== companies.length &&
                  ` (filtered from ${companies.length})`}
              </p>
            </motion.div>

            {/* Grid */}
            {filteredCompanies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredCompanies.map((company, i) => (
                  <CompanyCard key={company.yc_id} company={company} index={i} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-white/[0.06] flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-[#3f3f46]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-[#71717a] mb-1">
                  No companies match your filters
                </h3>
                <p className="text-xs text-[#3f3f46] font-light">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between text-[11px] text-[#3f3f46] font-light tracking-wide">
          <span>Startup Discovery Platform</span>
          <span>
            Data sourced from public APIs · Updated weekly
          </span>
        </div>
      </footer>
    </div>
  );
}
