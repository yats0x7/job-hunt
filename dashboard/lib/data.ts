import fs from "fs";
import path from "path";
import { Company, DataMetadata, CompanyData } from "./types";

/**
 * YC Bookface serves founder avatars as S3 presigned URLs that expire in ~1 hour.
 * The same objects are publicly readable without the signature query string
 * (confirmed: bookface-images.s3…/avatars/<hash>.jpg returns 200 unsigned).
 * Strip query/fragment so Vercel deploys keep working after the scrape session ends.
 * Also drop relative placeholders like "/avatars/thumb/missing.png".
 */
export function normalizePhotoUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return null; // relative / missing placeholders
  if (trimmed.includes("missing.png") || trimmed.includes("missing.jpg")) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    // Drop AWS signature / session query params
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function getCompanyData(): Promise<CompanyData> {
  const emptyMetadata: DataMetadata = {
    exported_at: new Date().toISOString(),
    total_companies: 0,
    avg_completeness: 0,
    hiring_count: 0,
    last_updated: new Date().toISOString(),
    tier_breakdown: { ats_api: 0, html_heuristic: 0, llm_extracted: 0, manual_visit: 0 },
    tier_percentages: { ats_api: 0, html_heuristic: 0, llm_extracted: 0, manual_visit: 0 },
  };

  try {
    let fileContent = "";
    
    // Primary path: public/companies.json in current directory (dashboard)
    const publicPath = path.join(process.cwd(), "public", "companies.json");
    if (fs.existsSync(publicPath)) {
      fileContent = fs.readFileSync(publicPath, "utf-8");
    } else {
      // Secondary path: data/companies.json relative to repository root
      const rootDataPath = path.join(process.cwd(), "..", "data", "companies.json");
      if (fs.existsSync(rootDataPath)) {
        fileContent = fs.readFileSync(rootDataPath, "utf-8");
      }
    }

    if (!fileContent || !fileContent.trim()) {
      return { metadata: emptyMetadata, companies: [] };
    }

    const raw = JSON.parse(fileContent);
    const rawCompanies: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw.companies ?? []);
    const metadata = Array.isArray(raw) ? null : (raw.metadata ?? null);

    // Sanitize every company with defensive defaults against unexpected nulls
    const companies: Company[] = rawCompanies.map((item: Record<string, unknown>) => {
      const c = item || {};
      const name = typeof c.name === "string" ? c.name : "Unknown Company";
      const slug = typeof c.slug === "string" ? c.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const foundersRaw = Array.isArray(c.founders) ? c.founders : [];
      const jobBoardRaw = (c.job_board && typeof c.job_board === "object") ? (c.job_board as Record<string, unknown>) : null;

      return {
        yc_id: typeof c.yc_id === "number" ? c.yc_id : null,
        name,
        slug,
        logo_url: typeof c.logo_url === "string" ? c.logo_url : null,
        website: typeof c.website === "string" ? c.website : null,
        location: typeof c.location === "string" ? c.location : null,
        description: typeof c.description === "string" ? c.description : null,
        long_description: typeof c.long_description === "string" ? c.long_description : null,
        industry: typeof c.industry === "string" ? c.industry : null,
        industries: Array.isArray(c.industries) ? c.industries.filter((i): i is string => typeof i === "string") : [],
        subindustry: typeof c.subindustry === "string" ? c.subindustry : null,
        batch: typeof c.batch === "string" ? c.batch : null,
        is_hiring: Boolean(c.is_hiring),
        is_top_company: Boolean(c.is_top_company),
        status: typeof c.status === "string" ? c.status : null,
        stage: typeof c.stage === "string" ? c.stage : null,
        team_size: typeof c.team_size === "number" ? c.team_size : null,
        tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === "string") : [],
        regions: Array.isArray(c.regions) ? c.regions.filter((r): r is string => typeof r === "string") : [],
        source_vc: typeof c.source_vc === "string" ? c.source_vc : "Y Combinator",
        founders: foundersRaw.map((fItem: unknown) => {
          const f = (fItem && typeof fItem === "object") ? (fItem as Record<string, unknown>) : {};
          return {
            name: typeof f.name === "string" ? f.name : "Founder",
            college: typeof f.college === "string" ? f.college : null,
            photo_url: normalizePhotoUrl(
              typeof f.photo_url === "string" ? f.photo_url : null
            ),
            linkedin_url: typeof f.linkedin_url === "string" ? f.linkedin_url : null,
            raw_bio: typeof f.raw_bio === "string" ? f.raw_bio : null,
          };
        }),
        job_board: jobBoardRaw
          ? {
              count: typeof jobBoardRaw.count === "number" ? jobBoardRaw.count : null,
              url: typeof jobBoardRaw.url === "string" ? jobBoardRaw.url : null,
              source_type: (typeof jobBoardRaw.source_type === "string" ? jobBoardRaw.source_type : "manual_visit") as Company["job_board"] extends { source_type: infer S } ? S : never,
              ats_platform: typeof jobBoardRaw.ats_platform === "string" ? jobBoardRaw.ats_platform : null,
            }
          : null,
        last_scraped: typeof c.last_scraped === "string" ? c.last_scraped : new Date().toISOString(),
        data_completeness: typeof c.data_completeness === "number" ? c.data_completeness : 0,
      };
    });

    const total = metadata?.total_companies ?? companies.length;
    const ats_api = companies.filter((c) => c.job_board?.source_type === "ats_api").length;
    const html_heuristic = companies.filter((c) => c.job_board?.source_type === "html_heuristic").length;
    const llm_extracted = companies.filter((c) => c.job_board?.source_type === "llm_extracted").length;
    const manual_visit = companies.filter((c) => c.job_board?.source_type === "manual_visit").length;

    const finalMetadata: DataMetadata = {
      exported_at: metadata?.exported_at ?? new Date().toISOString(),
      total_companies: total,
      avg_completeness:
        metadata?.avg_completeness ??
        (total > 0
          ? companies.reduce((acc, c) => acc + (c.data_completeness || 0), 0) / total
          : 0),
      hiring_count: metadata?.hiring_count ?? companies.filter((c) => c.is_hiring).length,
      last_updated: metadata?.last_updated ?? new Date().toISOString(),
      tier_breakdown: metadata?.tier_breakdown ?? { ats_api, html_heuristic, llm_extracted, manual_visit },
      tier_percentages: metadata?.tier_percentages ?? {
        ats_api: total ? (ats_api / total) * 100 : 0,
        html_heuristic: total ? (html_heuristic / total) * 100 : 0,
        llm_extracted: total ? (llm_extracted / total) * 100 : 0,
        manual_visit: total ? (manual_visit / total) * 100 : 0,
      },
    };

    return { metadata: finalMetadata, companies };
  } catch (error) {
    console.error("Error reading or parsing companies.json during build:", error);
    return { metadata: emptyMetadata, companies: [] };
  }
}
