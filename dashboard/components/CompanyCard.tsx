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
function batchColor(batch: string | null | undefined): string {
  if (!batch) return "bg-white/[0.04] text-[#71717a]";

  const match = batch.match(/(\d{4})/);
  if (!match) return "bg-white/[0.04] text-[#71717a]";

  const year = parseInt(match[1]);
  if (year >= 2024) return "bg-orange-500/10 text-orange-400/90 border-orange-500/10";
  if (year >= 2020) return "bg-blue-500/10 text-blue-400/90 border-blue-500/10";
  return "bg-white/[0.04] text-[#a1a1aa] border-white/[0.06]";
}

export default function CompanyCard({ company, index }: CompanyCardProps) {
  const router = useRouter();

  const name = company?.name ?? "Unknown Company";
  const slug = company?.slug ?? "unknown";
  const industries = company?.industries ?? [];
  const founders = company?.founders ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.03, ease: "easeOut" }}
    >
      <div
        id={`company-card-${slug}`}
        role="link"
        tabIndex={0}
        onClick={() => router.push(`/company/${slug}`)}
        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/company/${slug}`); }}
      >
        <div
          className="group relative bg-[#111111] border border-white/[0.06] rounded-xl p-5
            hover:border-white/[0.12] hover:-translate-y-0.5
            transition-all duration-200 ease-out cursor-pointer h-full flex flex-col"
        >
          {/* Top company badge */}
          {company?.is_top_company && (
            <div className="absolute -top-2 right-4">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-amber-500 text-[10px] font-semibold text-white rounded-full uppercase tracking-wider">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Top Company
              </span>
            </div>
          )}

          {/* Header: Logo + Name + Batch */}
          <div className="flex items-start gap-3.5 mb-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex-shrink-0 overflow-hidden flex items-center justify-center">
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={`${name} logo`}
                  referrerPolicy="no-referrer"
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
                className={`text-sm font-bold text-white w-full h-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg ${
                  company?.logo_url ? "hidden" : "flex"
                }`}
              >
                {name.charAt(0)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-[#e4e4e7] truncate group-hover:text-[#f97316] transition-colors duration-200">
                  {name}
                </h3>
                {company?.batch && (
                  <span
                    className={`px-1.5 py-px rounded-md text-[10px] font-medium border flex-shrink-0 ${batchColor(
                      company.batch
                    )}`}
                  >
                    {company.batch}
                  </span>
                )}
              </div>

              {/* Description */}
              {company?.description && (
                <p className="text-xs text-[#71717a] mt-1 line-clamp-2 leading-[1.6] font-light">
                  {company.description}
                </p>
              )}
            </div>
          </div>

          {/* Industry tags */}
          {industries.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {industries.slice(0, 3).map((ind) => (
                <span
                  key={ind}
                  className="px-2 py-px rounded-md text-[10px] font-normal bg-white/[0.03] text-[#71717a] border border-white/[0.04]"
                >
                  {ind}
                </span>
              ))}
            </div>
          )}

          {/* Location */}
          {company?.location && (
            <div className="flex items-center gap-1.5 mb-3 text-xs text-[#52525b]">
              <svg
                className="w-3 h-3 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
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
              <span className="truncate font-light">{company.location}</span>
            </div>
          )}

          {/* Footer: Founders + Jobs */}
          <div className="mt-auto pt-3 border-t border-white/[0.04] flex items-center justify-between gap-3">
            {founders.length > 0 ? (
              <FounderAvatarStack founders={founders} maxDisplay={2} />
            ) : (
              <div />
            )}

            <JobBadge jobBoard={company?.job_board} isHiring={Boolean(company?.is_hiring)} website={company?.website} />
          </div>

          {/* Hover reveal arrow */}
          <div className="absolute inset-x-0 bottom-0 h-0 group-hover:h-7 transition-all duration-200 overflow-hidden">
            <div className="flex items-center justify-center h-full text-[11px] font-normal text-[#f97316]/80 tracking-wide">
              View details
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="ml-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
