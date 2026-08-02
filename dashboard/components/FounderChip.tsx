"use client";

import { Founder } from "@/lib/types";

interface FounderChipProps {
  founder: Founder;
  size?: "sm" | "md";
}

export default function FounderChip({ founder, size = "sm" }: FounderChipProps) {
  const sizeClasses = size === "sm" ? "w-7 h-7" : "w-10 h-10";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  
  const name = founder?.name || "Founder";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "F";

  const colors = [
    "from-red-500/80 to-red-700/80",
    "from-orange-500/80 to-orange-700/80",
    "from-amber-500/80 to-amber-700/80",
    "from-emerald-500/80 to-emerald-700/80",
    "from-cyan-500/80 to-cyan-700/80",
    "from-blue-500/80 to-blue-700/80",
    "from-indigo-500/80 to-indigo-700/80",
    "from-violet-500/80 to-violet-700/80",
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorClass = colors[hash % colors.length];

  return (
    <div className="flex items-center gap-2.5 group" title={name}>
      {founder?.photo_url ? (
        <img
          src={founder.photo_url}
          alt={name}
          referrerPolicy="no-referrer"
          className={`${sizeClasses} rounded-full object-cover ring-1 ring-white/[0.06] group-hover:ring-[#f97316]/30 transition-all duration-200`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const next = target.nextElementSibling as HTMLElement;
            if (next) next.style.display = "flex";
          }}
        />
      ) : null}
      <div
        className={`${sizeClasses} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center ${textSize} font-medium text-white ring-1 ring-white/[0.06] group-hover:ring-white/[0.15] transition-all duration-200 ${
          founder?.photo_url ? "hidden" : ""
        }`}
      >
        {initials}
      </div>
      {size === "md" && (
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-[#e4e4e7]">
            {name}
          </span>
          {founder?.college ? (
            <span className="text-[11px] text-[#52525b] font-light">{founder.college}</span>
          ) : (
            <span className="text-[11px] text-[#3f3f46] font-light">Unknown</span>
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
  founders = [],
  maxDisplay = 2,
}: FounderAvatarStackProps) {
  const validFounders = Array.isArray(founders) ? founders : [];
  const displayed = validFounders.slice(0, maxDisplay);
  const remaining = validFounders.length - maxDisplay;

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
        <span className="text-[11px] text-[#52525b] ml-2 font-light">
          & {remaining} more
        </span>
      )}
      {validFounders.length > 0 && validFounders.length <= maxDisplay && (
        <span className="text-[11px] text-[#52525b] ml-2 truncate max-w-[120px] font-light">
          {validFounders[0]?.name}
          {validFounders.length > 1 ? ` +${validFounders.length - 1}` : ""}
        </span>
      )}
    </div>
  );
}
