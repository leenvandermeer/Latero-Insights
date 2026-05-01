import type { Metadata } from "next";
import { SettingsDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Settings — Latero Control",
};

export default function SettingsPage() {
  return <SettingsDashboard />;
}
