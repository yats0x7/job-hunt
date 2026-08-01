"use client";

import { motion } from "framer-motion";
import { DataMetadata } from "@/lib/types";

interface StatsBarProps {
  metadata: DataMetadata;
}

export default function StatsBar({ metadata }: StatsBarProps) {
  const formattedDate = metadata.last_updated
    ? new Date(metadata.last_updated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const completenessPercent = Math.round(metadata.avg_completeness * 100);
  const tp = metadata.tier_percentages;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-50"
    >
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        {/* Top row: Key stats */}
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <StatPill
            label="Companies tracked"
            value={metadata.total_companies.toLocaleString()}
            icon="📊"
          />
          <Divider />
          <StatPill
            label="Data complete"
            value={`${completenessPercent}%`}
            icon="✓"
            accent={completenessPercent >= 70}
          />
          <Divider />
          <StatPill
            label="Actively hiring"
            value={metadata.hiring_count.toLocaleString()}
            icon="🟢"
          />
          <Divider />
          <span className="text-[#71717a] text-xs">
            Last updated: {formattedDate}
          </span>
        </div>

        {/* Bottom row: Tier breakdown */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[#71717a] uppercase tracking-wider font-medium mr-2">
            Job data:
          </span>
          <TierBadge label="Verified API" percent={tp.ats_api} tier="ats_api" />
          <TierBadge
            label="Estimated"
            percent={tp.html_heuristic}
            tier="html_heuristic"
          />
          <TierBadge
            label="AI-extracted"
            percent={tp.llm_extracted}
            tier="llm_extracted"
          />
          <TierBadge
            label="Manual"
            percent={tp.manual_visit}
            tier="manual_visit"
          />
        </div>
      </div>
    </motion.div>
  );
}

function StatPill({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <div>
        <span
          className={`font-semibold text-sm ${
            accent ? "text-[#22c55e]" : "text-[#fafafa]"
          }`}
        >
          {value}
        </span>
        <span className="text-[#71717a] ml-1.5 text-xs">{label}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-[#27272a] hidden sm:block" />;
}

function TierBadge({
  label,
  percent,
  tier,
}: {
  label: string;
  percent: number;
  tier: string;
}) {
  const colors: Record<string, string> = {
    ats_api: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    html_heuristic: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    llm_extracted: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    manual_visit: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  };

  const dotColors: Record<string, string> = {
    ats_api: "bg-emerald-400",
    html_heuristic: "bg-blue-400",
    llm_extracted: "bg-violet-400",
    manual_visit: "bg-zinc-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
        colors[tier] || colors.manual_visit
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          dotColors[tier] || dotColors.manual_visit
        }`}
      />
      {percent.toFixed(1)}% {label}
    </span>
  );
}
