import type { Metadata } from "next";
import { AboutDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "About — Latero Meta Insights",
};

export default function AboutPage() {
  return <AboutDashboard />;
}
