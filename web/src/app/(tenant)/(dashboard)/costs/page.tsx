import type { Metadata } from "next";
import { CostDashboard } from "./cost-dashboard";

export const metadata: Metadata = {
  title: "Costs — Latero Control",
};

export default function CostPage() {
  return <CostDashboard />;
}
