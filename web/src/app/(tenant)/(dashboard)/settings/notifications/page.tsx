import { redirect } from "next/navigation";

export default function NotificationsPage() {
  // Redirect to settings with notifications tab active
  redirect("/settings?tab=notifications");
}