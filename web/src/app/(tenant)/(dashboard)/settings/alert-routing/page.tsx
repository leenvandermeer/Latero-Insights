import { redirect } from "next/navigation";

export default function AlertRoutingPage() {
  // Redirect to settings with alert-routing tab active
  redirect("/settings?tab=alert-routing");
}