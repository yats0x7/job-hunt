import { Company, DataMetadata, CompanyData } from "@/lib/types";
import DashboardClient from "@/components/DashboardClient";

async function getCompanyData(): Promise<CompanyData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/companies.json`, { 
    next: { revalidate: 3600 } // cache 1 hour
  });
  const data = await res.json();
  
  if (data.metadata && data.companies) {
    return data;
  }
  
  // If the json is just a list of companies (as suggested by the prompt's stats requirement),
  // we dynamically calculate the metadata.
  const companies: Company[] = data.companies || data;
  
  const ats_api = companies.filter(c => c.job_board?.source_type === "ats_api").length;
  const html_heuristic = companies.filter(c => c.job_board?.source_type === "html_heuristic").length;
  const llm_extracted = companies.filter(c => c.job_board?.source_type === "llm_extracted").length;
  const manual_visit = companies.filter(c => c.job_board?.source_type === "manual_visit").length;
  const total = companies.length;
  
  const metadata: DataMetadata = {
    exported_at: new Date().toISOString(),
    total_companies: total,
    avg_completeness: companies.reduce((acc, c) => acc + c.data_completeness, 0) / (total || 1),
    hiring_count: companies.filter(c => c.is_hiring).length,
    last_updated: new Date().toISOString(),
    tier_breakdown: { ats_api, html_heuristic, llm_extracted, manual_visit },
    tier_percentages: {
      ats_api: total ? (ats_api / total) * 100 : 0,
      html_heuristic: total ? (html_heuristic / total) * 100 : 0,
      llm_extracted: total ? (llm_extracted / total) * 100 : 0,
      manual_visit: total ? (manual_visit / total) * 100 : 0,
    }
  };
  
  return { metadata, companies };
}

export default async function Page() {
  const data = await getCompanyData();
  return <DashboardClient companies={data.companies} metadata={data.metadata} />;
}
