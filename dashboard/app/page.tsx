import { getCompanyData } from "@/lib/data";
import DashboardClient from "@/components/DashboardClient";

export default async function Page() {
  const data = await getCompanyData();
  return <DashboardClient companies={data.companies} metadata={data.metadata} />;
}
