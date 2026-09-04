"use client";

import { useState } from "react";
import { Founder } from "@/lib/types";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, { box: string; text: string }> = {
  sm: { box: "w-7 h-7", text: "text-[10px]" },
  md: { box: "w-10 h-10", text: "text-xs" },
  lg: { box: "w-12 h-12", text: "text-sm" },
};

const GRADIENTS = [
  "from-rose-500 to-rose-700",
  "from-orange-500 to-orange-700",
  "from-amber-500 to-amber-700",
  "from-emerald-500 to-emerald-700",
  "from-cyan-500 to-cyan-700",
  "from-blue-500 to-blue-700",
  "from-indigo-500 to-indigo-700",
  "from-violet-500 to-violet-700",
];

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "F"
  );
}

function gradientFor(name: string): string {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * Circular founder avatar with a deterministic gradient fallback when the
 * photo is missing or fails to load.
 */
export function FounderAvatar({
  founder,
  size = "sm",
  className = "",
}: {
  founder: Founder;
  size?: AvatarSize;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const name = founder?.name || "Founder";
  const { box, text } = SIZE_CLASSES[size];
  const showPhoto = Boolean(founder?.photo_url) && !broken;

  return (
    <div
      className={`${box} relative shrink-0 rounded-full ring-2 ring-background ${className}`}
      title={name}
    >
      {showPhoto ? (
        <img
          src={founder.photo_url as string}
          alt={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setBroken(true)}
          className="w-full h-full rounded-full object-cover bg-surface-raised"
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-gradient-to-br ${gradientFor(name)} flex items-center justify-center ${text} font-semibold text-white`}
          aria-label={name}
        >
          {initialsOf(name)}
        </div>
      )}
    </div>
  );
}

interface FounderChipProps {
  founder: Founder;
  size?: "sm" | "md";
}

export default function FounderChip({ founder, size = "sm" }: FounderChipProps) {
  const name = founder?.name || "Founder";

  return (
    <div className="flex items-center gap-3 min-w-0">
      <FounderAvatar founder={founder} size={size} />
      {size === "md" && (
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-medium text-foreground truncate">{name}</span>
          <span className={`text-[11px] truncate ${founder?.college ? "text-subtle" : "text-faint"}`}>
            {founder?.college ?? "Background unknown"}
          </span>
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
  maxDisplay = 3,
}: FounderAvatarStackProps) {
  const valid = Array.isArray(founders) ? founders : [];
  if (valid.length === 0) return null;

  const displayed = valid.slice(0, maxDisplay);
  const remaining = valid.length - displayed.length;
  const lead = valid[0]?.name || "Founder";
  const others = valid.length - 1;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex -space-x-2">
        {displayed.map((founder, i) => (
          <FounderAvatar
            key={`${founder?.name ?? "founder"}-${i}`}
            founder={founder}
            size="sm"
            className="transition-transform duration-200 group-hover:translate-x-0"
          />
        ))}
        {remaining > 0 && (
          <div className="w-7 h-7 rounded-full ring-2 ring-background bg-surface-raised border border-border flex items-center justify-center text-[10px] font-medium text-muted tabular-nums">
            +{remaining}
          </div>
        )}
      </div>
      <span className="text-[11px] text-subtle truncate max-w-[130px]">
        {lead}
        {others > 0 && <span className="text-faint"> +{others}</span>}
      </span>
    </div>
  );
}
