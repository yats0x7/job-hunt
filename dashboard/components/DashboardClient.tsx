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
      <header className="border-b border-[#27272a] bg-[#09090b]">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f97316] to-[#c2410c] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#fafafa] tracking-tight">
                Startup Discovery
              </h1>
              <p className="text-xs text-[#71717a] mt-0.5">
                Explore YC-backed companies · Live hiring data · Founder insights
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar metadata={metadata} />

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-8">
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
              className="flex items-center justify-between mb-6"
            >
              <p className="text-sm text-[#71717a]">
                <span className="text-[#fafafa] font-medium">
                  {filteredCompanies.length}
                </span>{" "}
                {filteredCompanies.length === 1 ? "company" : "companies"}
                {filteredCompanies.length !== companies.length &&
                  ` (filtered from ${companies.length})`}
              </p>
            </motion.div>

            {/* Grid */}
            {filteredCompanies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCompanies.map((company, i) => (
                  <CompanyCard key={company.yc_id} company={company} index={i} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-[#52525b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-[#a1a1aa] mb-1">
                  No companies match your filters
                </h3>
                <p className="text-xs text-[#52525b]">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-6 mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between text-xs text-[#52525b]">
          <span>Startup Discovery Platform</span>
          <span>
            Data sourced from public APIs · Updated weekly via GitHub Actions
          </span>
        </div>
      </footer>
    </div>
  );
}
