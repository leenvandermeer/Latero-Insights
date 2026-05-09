import type { Metadata } from "next";
import { ImpactExplorer } from "./impact-explorer";

export const metadata: Metadata = {
  title: "Business Impact — Latero Control",
};

export default function ImpactPage() {
  return <ImpactExplorer />;
}
