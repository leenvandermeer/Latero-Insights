import type { Metadata } from "next";
import { RunDetail } from "./run-detail";

export const metadata: Metadata = {
  title: "Run — Latero Control",
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ run_id: string }>;
}) {
  const { run_id } = await params;
  return <RunDetail runId={decodeURIComponent(run_id)} />;
}
