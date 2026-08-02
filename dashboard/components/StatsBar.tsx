"use client";

import { motion } from "framer-motion";
import { Company, DataMetadata } from "@/lib/types";

interface StatsBarProps {
  metadata: DataMetadata;
  companies: Company[];
}

/* ─── SVG Icon Components ────────────────────────────────────────── */

function BuildingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#a1a1aa]">
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M8 21v-4a4 4 0 018 0v4M8 11h1M15 11h1M8 15h1M15 15h1"/>
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#a1a1aa]">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#a1a1aa]">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#52525b]">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function StatsBar({ metadata, companies }: StatsBarProps) {
  const formattedDate = metadata.last_updated
    ? new Date(metadata.last_updated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const completenessPercent = Math.round(metadata.avg_completeness * 100);
  const tp = metadata.tier_percentages;

  const bySource = companies.reduce((acc: Record<string, number>, c: Company) => {
    acc[c.source_vc] = (acc[c.source_vc] || 0) + 1;
    return acc;
  }, {});

  const formattedSourceCounts = Object.entries(bySource)
    .map(([source, count]) => `${count} ${source === 'Y Combinator' ? 'YC' : source}`)
    .join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full border-b border-white/[0.06] sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0a]/80"
    >
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        {/* Top row: Key stats */}
        <div className="flex flex-wrap items-center gap-8 text-sm">
          <StatPill
            label="Companies tracked"
            value={formattedSourceCounts || metadata.total_companies.toLocaleString()}
            icon={<BuildingIcon />}
          />
          <Divider />
          <StatPill
            label="Data complete"
            value={`${completenessPercent}%`}
            icon={<CheckCircleIcon />}
            accent={completenessPercent >= 70}
          />
          <Divider />
          <StatPill
            label="Actively hiring"
            value={metadata.hiring_count.toLocaleString()}
            icon={<PulseIcon />}
          />
          <Divider />
          <span className="flex items-center gap-1.5 text-[#52525b] text-xs font-normal tracking-wide">
            <CalendarIcon />
            Updated {formattedDate}
          </span>
        </div>

        {/* Bottom row: Tier breakdown */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#52525b] uppercase tracking-[0.08em] font-medium mr-2">
            Job data
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

/* ─── Sub-components ─────────────────────────────────────────────── */

function StatPill({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-semibold text-[13px] tracking-tight ${
            accent ? "text-[#22c55e]" : "text-[#e4e4e7]"
          }`}
        >
          {value}
        </span>
        <span className="text-[#52525b] text-[11px] font-normal">{label}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-3.5 bg-white/[0.06] hidden sm:block" />;
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
    ats_api: "text-emerald-400/80 border-emerald-500/10",
    html_heuristic: "text-blue-400/80 border-blue-500/10",
    llm_extracted: "text-violet-400/80 border-violet-500/10",
    manual_visit: "text-zinc-400/80 border-zinc-500/10",
  };

  const dotColors: Record<string, string> = {
    ats_api: "bg-emerald-400",
    html_heuristic: "bg-blue-400",
    llm_extracted: "bg-violet-400",
    manual_visit: "bg-zinc-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-normal border ${
        colors[tier] || colors.manual_visit
      }`}
    >
      <span
        className={`w-[5px] h-[5px] rounded-full ${
          dotColors[tier] || dotColors.manual_visit
        }`}
      />
      <span className="font-light">{percent.toFixed(1)}%</span>
      <span className="opacity-60">{label}</span>
    </span>
  );
}
