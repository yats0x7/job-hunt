"use client";

import { JobBoardResult } from "@/lib/types";

interface JobBadgeProps {
  jobBoard: JobBoardResult | null;
  isHiring: boolean;
  website?: string | null;
}

export default function JobBadge({ jobBoard, isHiring, website }: JobBadgeProps) {
  if (!isHiring && (!jobBoard || jobBoard.count === null)) {
    return null;
  }

  if (jobBoard && jobBoard.count !== null && jobBoard.count > 0) {
    return (
      <a
        href={jobBoard.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
          bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
          hover:bg-emerald-500/20 hover:border-emerald-500/30
          transition-all duration-200 group"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {jobBoard.count} open role{jobBoard.count !== 1 ? "s" : ""}
        <span className="text-emerald-500 group-hover:translate-x-0.5 transition-transform duration-200">
          →
        </span>
      </a>
    );
  }

  if (!jobBoard || jobBoard.count === null) {
    if (!website) return null;
    return (
      <a
        href={`${website}/careers`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
          bg-[#27272a]/50 text-[#a1a1aa] border border-[#3f3f46]
          hover:bg-[#3f3f46] hover:text-[#d4d4d8]
          transition-all duration-200 group"
        onClick={(e) => e.stopPropagation()}
      >
        Visit careers
        <span className="text-[#71717a] group-hover:translate-x-0.5 transition-transform duration-200">
          →
        </span>
      </a>
    );
  }

  return null;
}

export function JobSourceBadge({
  jobBoard,
}: {
  jobBoard: JobBoardResult | null;
}) {
  if (!jobBoard) return null;

  const config: Record<
    string,
    { label: string; dot: string; classes: string }
  > = {
    ats_api: {
      label: "Verified",
      dot: "bg-emerald-400",
      classes: "text-emerald-400",
    },
    html_heuristic: {
      label: "Estimated",
      dot: "bg-blue-400",
      classes: "text-blue-400",
    },
    llm_extracted: {
      label: "AI-extracted",
      dot: "bg-violet-400",
      classes: "text-violet-400",
    },
    manual_visit: {
      label: "Manual",
      dot: "bg-zinc-400",
      classes: "text-zinc-400",
    },
  };

  const tier = config[jobBoard.source_type] || config.manual_visit;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${tier.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
      {tier.label}
      {jobBoard.ats_platform && (
        <span className="text-[#52525b]">via {jobBoard.ats_platform}</span>
      )}
    </span>
  );
}
