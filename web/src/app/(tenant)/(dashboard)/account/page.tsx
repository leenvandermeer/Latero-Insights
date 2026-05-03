import type { Metadata } from "next";
import { AccountDashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Account — Latero Control",
};

export default function AccountPage() {
  return <AccountDashboard />;
}
