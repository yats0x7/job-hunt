import { getCompanyData, toCompanySummary } from "@/lib/data";
import DashboardClient from "@/components/DashboardClient";

export default async function Page() {
  const data = await getCompanyData();
  return (
    <DashboardClient
      companies={data.companies.map(toCompanySummary)}
      metadata={data.metadata}
    />
  );
}
