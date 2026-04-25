import type { Metadata } from "next";
import { SettingsDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Settings — Latero Meta Insights",
};

export default function SettingsPage() {
  return <SettingsDashboard />;
}
