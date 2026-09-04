"use client";

import { motion } from "framer-motion";
import { Company, DataMetadata } from "@/lib/types";
import { plural } from "@/lib/format";
import { BuildingIcon, LayersIcon, PulseIcon, ShieldCheckIcon } from "./Icons";

interface StatsBarProps {
  metadata: DataMetadata;
  companies: Company[];
}

const TIERS = [
  { key: "ats_api", label: "Verified", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  { key: "html_heuristic", label: "Estimated", bar: "bg-blue-400", dot: "bg-blue-400" },
  { key: "llm_extracted", label: "AI-extracted", bar: "bg-violet-400", dot: "bg-violet-400" },
  { key: "manual_visit", label: "Manual", bar: "bg-zinc-500", dot: "bg-zinc-500" },
] as const;

export default function StatsBar({ metadata, companies = [] }: StatsBarProps) {
  const valid = Array.isArray(companies) ? companies : [];

  const totalCompanies = metadata?.total_companies ?? valid.length;
  const completeness = Math.round((metadata?.avg_completeness ?? 0) * 100);
  const hiringCount = metadata?.hiring_count ?? 0;
  const tiers = metadata?.tier_percentages ?? {
    ats_api: 0,
    html_heuristic: 0,
    llm_extracted: 0,
    manual_visit: 0,
  };

  const openRoles = valid.reduce((sum, c) => sum + (c?.job_board?.count ?? 0), 0);
  const boardsWithCounts = valid.filter((c) => (c?.job_board?.count ?? 0) > 0).length;

  const bySource = valid.reduce<Record<string, number>>((acc, c) => {
    const src = c?.source_vc || "Y Combinator";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});
  const sourceSummary = Object.entries(bySource)
    .map(([source, count]) => `${count.toLocaleString()} from ${source}`)
    .join(" · ");

  return (
    <motion.section
      aria-label="Dataset overview"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-[1400px] mx-auto w-full px-4 sm:px-6"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl border border-border bg-border overflow-hidden">
        <StatTile
          icon={<BuildingIcon size={15} />}
          label="Companies tracked"
          value={totalCompanies.toLocaleString()}
          detail={sourceSummary || "Y Combinator"}
        />

        <StatTile
          icon={<ShieldCheckIcon size={15} />}
          label="Data completeness"
          value={`${completeness}%`}
          valueClass={completeness >= 70 ? "text-emerald-300" : undefined}
          detail={
            <div
              className="mt-1 h-1.5 w-full max-w-[160px] rounded-full bg-white/[0.06] overflow-hidden"
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400"
                style={{ width: `${completeness}%` }}
              />
            </div>
          }
        />

        <StatTile
          icon={<PulseIcon size={15} />}
          label="Actively hiring"
          value={hiringCount.toLocaleString()}
          detail={
            openRoles > 0
              ? `${openRoles.toLocaleString()} open ${plural(openRoles, "role")} across ${boardsWithCounts} verified ${plural(boardsWithCounts, "board")}`
              : "Hiring status from YC"
          }
        />

        <div className="bg-surface p-4 sm:p-5 flex flex-col gap-3 min-w-0">
          <div className="flex items-start gap-2 text-subtle">
            <span className="shrink-0 mt-px">
              <LayersIcon size={15} />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] leading-tight">
              Job data sources
            </span>
          </div>

          <div className="flex h-2 w-full rounded-full overflow-hidden bg-white/[0.05]" aria-hidden>
            {TIERS.map((tier) => {
              const pct = Math.max(0, tiers[tier.key] ?? 0);
              if (pct <= 0) return null;
              return (
                <div
                  key={tier.key}
                  className={`${tier.bar} h-full first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>

          <ul className="flex flex-wrap gap-x-3.5 gap-y-1">
            {TIERS.map((tier) => (
              <li
                key={tier.key}
                className="flex items-center gap-1.5 text-[11px] text-subtle whitespace-nowrap"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tier.dot}`} />
                {tier.label}
                <span className="tabular-nums text-muted">
                  {(tiers[tier.key] ?? 0).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  );
}

function StatTile({
  icon,
  label,
  value,
  detail,
  valueClass = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-surface p-4 sm:p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-start gap-2 text-subtle">
        <span className="shrink-0 mt-px">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] leading-tight">{label}</span>
      </div>
      <div className={`text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums leading-none ${valueClass}`}>
        {value}
      </div>
      {typeof detail === "string" ? (
        <p className="text-[11px] text-subtle leading-snug">{detail}</p>
      ) : (
        detail
      )}
    </div>
  );
}
