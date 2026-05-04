import type { Metadata } from "next";
import { RunsExplorer } from "./runs-explorer";

export const metadata: Metadata = {
  title: "Runs — Latero Control",
};

export default function RunsPage() {
  return <RunsExplorer />;
}
