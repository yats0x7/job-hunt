"use client";

import { JobBoardResult } from "@/lib/types";

interface JobBadgeProps {
  jobBoard?: JobBoardResult | null;
  isHiring?: boolean;
  website?: string | null;
}

export default function JobBadge({ jobBoard, isHiring = false, website }: JobBadgeProps) {
  if (!isHiring && (!jobBoard || jobBoard.count === null || jobBoard.count === undefined)) {
    return null;
  }

  if (jobBoard && jobBoard.count !== null && jobBoard.count !== undefined && jobBoard.count > 0) {
    return (
      <a
        href={jobBoard.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
          bg-emerald-500/8 text-emerald-400/90 border border-emerald-500/10
          hover:bg-emerald-500/15 hover:border-emerald-500/20
          transition-all duration-200 group"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
        {jobBoard.count} open role{jobBoard.count !== 1 ? "s" : ""}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500/60 group-hover:translate-x-0.5 transition-transform duration-200">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
        </svg>
      </a>
    );
  }

  if (!jobBoard || jobBoard.count === null || jobBoard.count === undefined) {
    if (!website) return null;
    return (
      <a
        href={`${website}/careers`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-normal
          bg-white/[0.03] text-[#71717a] border border-white/[0.06]
          hover:bg-white/[0.06] hover:text-[#a1a1aa]
          transition-all duration-200 group"
        onClick={(e) => e.stopPropagation()}
      >
        Visit careers
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#52525b] group-hover:translate-x-0.5 transition-transform duration-200">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
        </svg>
      </a>
    );
  }

  return null;
}

export function JobSourceBadge({
  jobBoard,
}: {
  jobBoard?: JobBoardResult | null;
}) {
  if (!jobBoard) return null;

  const config: Record<
    string,
    { label: string; dot: string; classes: string }
  > = {
    ats_api: {
      label: "Verified",
      dot: "bg-emerald-400",
      classes: "text-emerald-400/80",
    },
    html_heuristic: {
      label: "Estimated",
      dot: "bg-blue-400",
      classes: "text-blue-400/80",
    },
    llm_extracted: {
      label: "AI-extracted",
      dot: "bg-violet-400",
      classes: "text-violet-400/80",
    },
    manual_visit: {
      label: "Manual",
      dot: "bg-zinc-400",
      classes: "text-zinc-400/80",
    },
  };

  const tier = config[jobBoard.source_type] || config.manual_visit;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-normal ${tier.classes}`}
    >
      <span className={`w-1 h-1 rounded-full ${tier.dot}`} />
      {tier.label}
      {jobBoard.ats_platform && (
        <span className="text-[#3f3f46] font-light">via {jobBoard.ats_platform}</span>
      )}
    </span>
  );
}
