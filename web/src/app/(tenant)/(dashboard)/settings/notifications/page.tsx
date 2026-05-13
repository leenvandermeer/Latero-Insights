import type { Metadata } from "next";
import { NotificationsSettings } from "./notifications";

export const metadata: Metadata = {
  title: "Notifications — Settings | Latero Control",
};

export default function NotificationsPage() {
  return <NotificationsSettings />;
}
