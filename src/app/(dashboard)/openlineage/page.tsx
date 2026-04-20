import type { Metadata } from "next";
import { OpenLineageDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "OpenLineage Viewer — Latero Meta Insights",
};

export default function OpenLineagePage() {
  return <OpenLineageDashboard />;
}
