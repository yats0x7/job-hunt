"use client";

import { JobBoardResult } from "@/lib/types";
import { ArrowRightIcon } from "./Icons";

interface JobBadgeProps {
  jobBoard?: JobBoardResult | null;
  isHiring?: boolean;
  website?: string | null;
}

const stop = (e: React.MouseEvent) => e.stopPropagation();

export default function JobBadge({ jobBoard, isHiring = false, website }: JobBadgeProps) {
  const hasCount =
    jobBoard !== null &&
    jobBoard !== undefined &&
    jobBoard.count !== null &&
    jobBoard.count !== undefined;

  if (!isHiring && !hasCount) return null;

  if (hasCount && (jobBoard!.count as number) > 0) {
    const count = jobBoard!.count as number;
    const label = `${count} open role${count !== 1 ? "s" : ""}`;
    const classes =
      "inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-full text-[11px] font-medium whitespace-nowrap " +
      "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 tabular-nums";

    if (!jobBoard!.url) {
      return (
        <span className={classes}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {label}
        </span>
      );
    }

    return (
      <a
        href={jobBoard!.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        className={`${classes} group/badge hover:bg-emerald-500/20 hover:border-emerald-400/40`}
      >
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </span>
        {label}
        <ArrowRightIcon
          size={11}
          className="text-emerald-400/70 transition-transform duration-200 group-hover/badge:translate-x-0.5"
        />
      </a>
    );
  }

  if (!hasCount) {
    if (!website) return null;
    const careersUrl = `${website.replace(/\/+$/, "")}/careers`;
    return (
      <a
        href={careersUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        className="group/badge inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-full text-[11px] font-medium whitespace-nowrap
          bg-white/[0.03] text-subtle border border-border
          hover:bg-white/[0.06] hover:text-muted hover:border-border-strong"
      >
        Visit careers
        <ArrowRightIcon
          size={11}
          className="text-faint transition-transform duration-200 group-hover/badge:translate-x-0.5"
        />
      </a>
    );
  }

  return null;
}

const TIER_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  ats_api: { label: "Verified", dot: "bg-emerald-400", text: "text-emerald-300" },
  html_heuristic: { label: "Estimated", dot: "bg-blue-400", text: "text-blue-300" },
  llm_extracted: { label: "AI-extracted", dot: "bg-violet-400", text: "text-violet-300" },
  manual_visit: { label: "Manual", dot: "bg-zinc-400", text: "text-zinc-300" },
};

export function JobSourceBadge({ jobBoard }: { jobBoard?: JobBoardResult | null }) {
  if (!jobBoard) return null;
  const tier = TIER_CONFIG[jobBoard.source_type] || TIER_CONFIG.manual_visit;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${tier.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
      {tier.label}
      {jobBoard.ats_platform && (
        <span className="text-faint font-normal">
          via <span className="capitalize text-subtle">{jobBoard.ats_platform}</span>
        </span>
      )}
    </span>
  );
}
