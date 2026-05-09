import type { Metadata } from "next";
import { AlertFeed } from "./alert-feed";

export const metadata: Metadata = {
  title: "Alerts — Latero Control",
};

export default function AlertsPage() {
  return <AlertFeed />;
}
