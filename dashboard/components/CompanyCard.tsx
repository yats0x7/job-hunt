"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Company } from "@/lib/types";
import { FounderAvatarStack } from "./FounderChip";
import JobBadge from "./JobBadge";

interface CompanyCardProps {
  company: Company;
  index: number;
}

/**
 * Returns a color class for batch era badges.
 * Recent batches = warm orange, older = muted zinc.
 */
function batchColor(batch: string | null): string {
  if (!batch) return "bg-[#27272a] text-[#71717a]";

  const match = batch.match(/(\d{4})/);
  if (!match) return "bg-[#27272a] text-[#71717a]";

  const year = parseInt(match[1]);
  if (year >= 2024) return "bg-orange-500/15 text-orange-400 border-orange-500/20";
  if (year >= 2020) return "bg-blue-500/15 text-blue-400 border-blue-500/20";
  return "bg-[#27272a] text-[#a1a1aa] border-[#3f3f46]";
}

export default function CompanyCard({ company, index }: CompanyCardProps) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <div
        id={`company-card-${company.slug}`}
        role="link"
        tabIndex={0}
        onClick={() => router.push(`/company/${company.slug}`)}
        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/company/${company.slug}`); }}
      >
        <div
          className="group relative bg-[#18181b] border border-[#27272a] rounded-xl p-5
            hover:border-[#f97316]/30 hover:shadow-[0_0_30px_rgba(249,115,22,0.06)]
            hover:-translate-y-0.5
            transition-all duration-300 ease-out cursor-pointer h-full flex flex-col"
        >
          {/* Top company badge */}
          {company.is_top_company && (
            <div className="absolute -top-2 right-4">
              <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-amber-500 text-[10px] font-bold text-white rounded-full uppercase tracking-wider shadow-lg shadow-orange-500/20">
                Top Company
              </span>
            </div>
          )}

          {/* Header: Logo + Name + Batch */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#27272a] flex-shrink-0 overflow-hidden flex items-center justify-center">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={`${company.name} logo`}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <span
                className={`text-sm font-bold text-white w-full h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 ${
                  company.logo_url ? "hidden" : "flex"
                }`}
              >
                {company.name.charAt(0)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#fafafa] truncate group-hover:text-[#f97316] transition-colors duration-200">
                  {company.name}
                </h3>
                {company.batch && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${batchColor(
                      company.batch
                    )}`}
                  >
                    {company.batch}
                  </span>
                )}
              </div>

              {/* Description */}
              {company.description && (
                <p className="text-xs text-[#a1a1aa] mt-1 line-clamp-2 leading-relaxed">
                  {company.description}
                </p>
              )}
            </div>
          </div>

          {/* Industry tags */}
          {company.industries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {company.industries.slice(0, 3).map((ind) => (
                <span
                  key={ind}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#27272a]/80 text-[#a1a1aa] border border-[#3f3f46]/50"
                >
                  {ind}
                </span>
              ))}
            </div>
          )}

          {/* Location */}
          {company.location && (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-[#71717a]">
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
              <span className="truncate">{company.location}</span>
            </div>
          )}

          {/* Footer: Founders + Jobs */}
          <div className="mt-auto pt-3 border-t border-[#27272a]/50 flex items-center justify-between gap-3">
            {company.founders.length > 0 ? (
              <FounderAvatarStack founders={company.founders} maxDisplay={2} />
            ) : (
              <div />
            )}

            <JobBadge jobBoard={company.job_board} isHiring={company.is_hiring} website={company.website} />
          </div>

          {/* Hover reveal */}
          <div className="absolute inset-x-0 bottom-0 h-0 group-hover:h-8 transition-all duration-300 overflow-hidden">
            <div className="flex items-center justify-center h-full text-[11px] font-medium text-[#f97316]">
              View details →
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
