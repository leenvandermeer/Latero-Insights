import type { Metadata } from "next";
import { LineageDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Lineage Explorer — Latero Control",
};

export default function LineagePage() {
  return <LineageDashboard />;
}
