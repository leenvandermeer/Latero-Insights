import type { Metadata } from "next";
import { EntityDetail } from "./entity-detail";

export const metadata: Metadata = {
  title: "Entity — Latero Control",
};

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ fqn: string }>;
}) {
  const { fqn } = await params;
  return <EntityDetail fqn={decodeURIComponent(fqn)} />;
}
