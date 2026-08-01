"use client";

import { Founder } from "@/lib/types";

interface FounderChipProps {
  founder: Founder;
  size?: "sm" | "md";
}

export default function FounderChip({ founder, size = "sm" }: FounderChipProps) {
  const sizeClasses = size === "sm" ? "w-7 h-7" : "w-10 h-10";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const initials = founder.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    "from-red-500 to-red-700",
    "from-orange-500 to-orange-700",
    "from-amber-500 to-amber-700",
    "from-emerald-500 to-emerald-700",
    "from-cyan-500 to-cyan-700",
    "from-blue-500 to-blue-700",
    "from-indigo-500 to-indigo-700",
    "from-violet-500 to-violet-700",
  ];
  const hash = founder.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorClass = colors[hash % colors.length];

  return (
    <div className="flex items-center gap-2 group" title={founder.name}>
      {founder.photo_url ? (
        <img
          src={founder.photo_url}
          alt={founder.name}
          className={`${sizeClasses} rounded-full object-cover ring-2 ring-[#27272a] group-hover:ring-[#f97316]/50 transition-all duration-200`}
          onError={(e) => {
            // Fallback to initials on image load error
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const next = target.nextElementSibling as HTMLElement;
            if (next) next.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className={`${sizeClasses} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center ${textSize} font-semibold text-white ring-2 ring-[#27272a] group-hover:ring-white/30 transition-all duration-200 ${
          founder.photo_url ? "hidden" : ""
        }`}
      >
        {initials}
      </div>
      {size === "md" && (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#fafafa]">
            {founder.name}
          </span>
          {founder.college ? (
            <span className="text-xs text-[#71717a]">{founder.college}</span>
          ) : (
            <span className="text-xs text-[#71717a]">Unknown</span>
          )}
        </div>
      )}
    </div>
  );
}

interface FounderAvatarStackProps {
  founders: Founder[];
  maxDisplay?: number;
}

export function FounderAvatarStack({
  founders,
  maxDisplay = 2,
}: FounderAvatarStackProps) {
  const displayed = founders.slice(0, maxDisplay);
  const remaining = founders.length - maxDisplay;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {displayed.map((f, i) => (
          <div key={i} className="relative" style={{ zIndex: maxDisplay - i }}>
            <FounderChip founder={f} size="sm" />
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <span className="text-[11px] text-[#71717a] ml-2">
          & {remaining} more
        </span>
      )}
      {founders.length > 0 && founders.length <= maxDisplay && (
        <span className="text-[11px] text-[#71717a] ml-2 truncate max-w-[120px]">
          {founders[0]?.name}
          {founders.length > 1 ? ` +${founders.length - 1}` : ""}
        </span>
      )}
    </div>
  );
}
