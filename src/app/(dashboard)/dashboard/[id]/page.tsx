import { DashboardPage } from "./dashboard-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardPage dashboardId={id} />;
}
