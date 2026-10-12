"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CompanySummary } from "@/lib/types";
import { batchChipClasses } from "@/lib/format";
import { FounderAvatarStack } from "./FounderChip";
import JobBadge from "./JobBadge";
import { ArrowRightIcon, PinIcon, StarIcon } from "./Icons";

interface CompanyCardProps {
  company: CompanySummary;
  index: number;
}

const MAX_STAGGER = 18;
const MAX_INDUSTRIES = 3;

export default function CompanyCard({ company, index }: CompanyCardProps) {
  const router = useRouter();
  const [logoBroken, setLogoBroken] = useState(false);

  const name = company?.name ?? "Unknown Company";
  const slug = company?.slug ?? "unknown";
  const industries = company?.industries ?? [];
  const founders = company?.founders ?? [];
  const href = `/company/${slug}`;

  const meta = [
    company?.location,
    company?.stage ? `${company.stage} stage` : null,
    company?.team_size ? `${company.team_size.toLocaleString()} people` : null,
  ].filter(Boolean) as string[];

  const navigate = () => router.push(href);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index, MAX_STAGGER) * 0.03,
        ease: "easeOut",
      }}
      className="h-full"
    >
      <div
        id={`company-card-${slug}`}
        role="link"
        tabIndex={0}
        aria-label={`View ${name}`}
        onClick={navigate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate();
          }
        }}
        className="group relative h-full flex flex-col rounded-2xl bg-surface border border-border p-5 cursor-pointer
          transition-[border-color,box-shadow,transform] duration-200 ease-out
          hover:-translate-y-0.5 hover:border-accent/30
          hover:shadow-[0_0_0_1px_rgba(249,115,22,0.10),0_20px_40px_-20px_rgba(249,115,22,0.35)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] overflow-hidden flex items-center justify-center">
            {company?.logo_url && !logoBroken ? (
              <img
                src={company.logo_url}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => setLogoBroken(true)}
                className="w-full h-full object-contain p-1.5"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600">
                {name.charAt(0)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[14px] font-semibold text-foreground truncate group-hover:text-accent transition-colors duration-200">
                {name}
              </h3>
              {company?.batch && (
                <span
                  className={`shrink-0 px-1.5 py-px rounded-md text-[10px] font-medium border ${batchChipClasses(
                    company.batch
                  )}`}
                >
                  {company.batch}
                </span>
              )}
            </div>
            {meta.length > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-subtle truncate">
                {company?.location && <PinIcon size={11} className="shrink-0 text-faint" />}
                <span className="truncate">{meta.join(" · ")}</span>
              </p>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            {company?.is_top_company && (
              <span
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-300 text-[10px] font-semibold uppercase tracking-wider"
                title="YC top company"
              >
                <StarIcon size={10} />
                Top
              </span>
            )}
            <span
              aria-hidden
              className="w-7 h-7 rounded-full border border-border bg-white/[0.03] flex items-center justify-center text-faint
                opacity-0 -translate-x-1 transition-all duration-200
                group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-accent group-hover:border-accent/30
                group-focus-visible:opacity-100 group-focus-visible:translate-x-0"
            >
              <ArrowRightIcon size={13} />
            </span>
          </div>
        </div>

        {/* Description */}
        {company?.description && (
          <p className="mt-3.5 text-[13px] text-muted leading-[1.6] line-clamp-2">
            {company.description}
          </p>
        )}

        {/* Industries */}
        {industries.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {industries.slice(0, MAX_INDUSTRIES).map((industry) => (
              <span
                key={industry}
                className="px-2 py-0.5 rounded-md text-[11px] bg-white/[0.04] text-subtle border border-border"
              >
                {industry}
              </span>
            ))}
            {industries.length > MAX_INDUSTRIES && (
              <span className="px-1.5 py-0.5 rounded-md text-[11px] text-faint tabular-nums">
                +{industries.length - MAX_INDUSTRIES}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4">
          <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
            {founders.length > 0 ? <FounderAvatarStack founders={founders} maxDisplay={3} /> : <span />}
            <JobBadge
              jobBoard={company?.job_board}
              isHiring={Boolean(company?.is_hiring)}
              website={company?.website}
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
