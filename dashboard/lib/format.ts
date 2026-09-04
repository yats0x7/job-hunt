/**
 * Small presentation helpers shared by the dashboard and detail pages.
 * Dates are rendered in UTC so server and client markup always match.
 */

export function formatDate(
  value: string | null | undefined,
  style: "short" | "long" = "short"
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : pluralForm ?? `${singular}s`;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** Colour classes for a YC batch chip: recent batches are warm, older ones cool. */
export function batchChipClasses(batch: string | null | undefined): string {
  const year = parseInt(batch?.match(/(\d{4})/)?.[1] ?? "0", 10);
  if (year >= 2024) return "bg-accent/10 text-orange-300 border-accent/20";
  if (year >= 2020) return "bg-blue-500/10 text-blue-300 border-blue-500/20";
  return "bg-white/[0.04] text-muted border-border";
}
