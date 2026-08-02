import { Company, DataMetadata, CompanyData } from "@/lib/types";
import DashboardClient from "@/components/DashboardClient";

async function getCompanyData(): Promise<CompanyData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/companies.json`, { 
    next: { revalidate: 3600 } // cache 1 hour
  });
  
  const raw = await res.json();
  const companies = Array.isArray(raw) ? raw : raw.companies ?? [];
  const metadata = Array.isArray(raw) ? null : raw.metadata ?? null;

  // Use metadata directly if available, else calculate
  const total = metadata?.total_companies ?? companies.length;
  
  const ats_api = companies.filter((c: Company) => c.job_board?.source_type === "ats_api").length;
  const html_heuristic = companies.filter((c: Company) => c.job_board?.source_type === "html_heuristic").length;
  const llm_extracted = companies.filter((c: Company) => c.job_board?.source_type === "llm_extracted").length;
  const manual_visit = companies.filter((c: Company) => c.job_board?.source_type === "manual_visit").length;
  
  const finalMetadata: DataMetadata = {
    exported_at: metadata?.exported_at ?? new Date().toISOString(),
    total_companies: total,
    avg_completeness: metadata?.avg_completeness ?? (companies.reduce((acc: number, c: Company) => acc + c.data_completeness, 0) / (total || 1)),
    hiring_count: metadata?.hiring_count ?? companies.filter((c: Company) => c.is_hiring).length,
    last_updated: metadata?.last_updated ?? new Date().toISOString(),
    tier_breakdown: metadata?.tier_breakdown ?? { ats_api, html_heuristic, llm_extracted, manual_visit },
    tier_percentages: metadata?.tier_percentages ?? {
      ats_api: total ? (ats_api / total) * 100 : 0,
      html_heuristic: total ? (html_heuristic / total) * 100 : 0,
      llm_extracted: total ? (llm_extracted / total) * 100 : 0,
      manual_visit: total ? (manual_visit / total) * 100 : 0,
    }
  };
  
  return { metadata: finalMetadata, companies };
}

export default async function Page() {
  const data = await getCompanyData();
  return <DashboardClient companies={data.companies} metadata={data.metadata} />;
}
