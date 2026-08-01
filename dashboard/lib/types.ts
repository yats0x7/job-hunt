/**
 * TypeScript types matching the Python Pydantic models exactly.
 * These are the canonical types for the dashboard.
 */

export interface Founder {
  name: string;
  college: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  raw_bio: string | null;
}

export type SourceType = "ats_api" | "html_heuristic" | "llm_extracted" | "manual_visit";

export interface JobBoardResult {
  count: number | null;
  url: string | null;
  source_type: SourceType;
  ats_platform: string | null;
}

export interface Company {
  yc_id: number | null;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  location: string | null;
  description: string | null;
  long_description: string | null;
  industry: string | null;
  industries: string[];
  subindustry: string | null;
  batch: string | null;
  is_hiring: boolean;
  is_top_company: boolean;
  status: string | null;
  stage: string | null;
  team_size: number | null;
  tags: string[];
  regions: string[];
  source_vc: string;
  founders: Founder[];
  job_board: JobBoardResult | null;
  last_scraped: string;
  data_completeness: number;
}

export interface TierBreakdown {
  ats_api: number;
  html_heuristic: number;
  llm_extracted: number;
  manual_visit: number;
}

export interface DataMetadata {
  exported_at: string;
  total_companies: number;
  avg_completeness: number;
  hiring_count: number;
  last_updated: string;
  tier_breakdown: TierBreakdown;
  tier_percentages: TierBreakdown;
}

export interface CompanyData {
  metadata: DataMetadata;
  companies: Company[];
}
