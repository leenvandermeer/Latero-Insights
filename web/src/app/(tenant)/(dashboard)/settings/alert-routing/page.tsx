import type { Metadata } from "next";
import { AlertRoutingSettings } from "./alert-routing";

export const metadata: Metadata = {
  title: "Alert Routing — Settings | Latero Control",
};

export default function AlertRoutingPage() {
  return <AlertRoutingSettings />;
}
