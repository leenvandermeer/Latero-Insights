import type { Metadata } from "next";
import { ComplianceDashboard } from "./compliance-dashboard";

export const metadata: Metadata = {
  title: "Compliance — Latero Control",
};

export default function CompliancePage() {
  return <ComplianceDashboard />;
}
