import type { Metadata } from "next";
import { QualityCheckDetail } from "./quality-check-detail";

export const metadata: Metadata = {
  title: "DQ Check Detail — Latero Control",
};

export default async function QualityCheckDetailPage({
  params,
}: {
  params: Promise<{ result_id: string }>;
}) {
  const { result_id } = await params;
  return <QualityCheckDetail resultId={result_id} />;
}
