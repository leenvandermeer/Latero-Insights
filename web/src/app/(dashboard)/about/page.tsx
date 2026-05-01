import type { Metadata } from "next";
import { AboutDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "About — Latero Control",
};

export default function AboutPage() {
  return <AboutDashboard />;
}
