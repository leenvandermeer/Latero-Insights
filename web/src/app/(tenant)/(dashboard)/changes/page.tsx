import type { Metadata } from "next";
import { ChangeFeed } from "./change-feed";

export const metadata: Metadata = {
  title: "Changes — Latero Control",
};

export default function ChangesPage() {
  return <ChangeFeed />;
}
