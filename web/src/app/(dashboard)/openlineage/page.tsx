import type { Metadata } from "next";
import { OpenLineageDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "OpenLineage Viewer — Latero Control",
};

export default function OpenLineagePage() {
  return <OpenLineageDashboard />;
}
