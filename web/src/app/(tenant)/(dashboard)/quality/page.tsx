import type { Metadata } from "next";
import { QualityExplorer } from "./quality-explorer";

export const metadata: Metadata = {
  title: "Data Quality — Latero Control",
};

export default function QualityPage() {
  return <QualityExplorer />;
}
