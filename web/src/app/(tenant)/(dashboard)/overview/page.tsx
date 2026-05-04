import type { Metadata } from "next";
import { HealthOverview } from "./health-overview";

export const metadata: Metadata = {
  title: "Overview — Latero Control",
};

export default function OverviewPage() {
  return <HealthOverview />;
}
