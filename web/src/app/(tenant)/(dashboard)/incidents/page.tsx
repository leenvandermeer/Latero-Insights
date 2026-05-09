import type { Metadata } from "next";
import { IncidentHub } from "./incident-hub";

export const metadata: Metadata = {
  title: "Issues — Latero Control",
};

export default function IncidentsPage() {
  return <IncidentHub />;
}
