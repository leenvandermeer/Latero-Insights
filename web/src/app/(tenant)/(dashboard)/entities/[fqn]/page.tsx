import type { Metadata } from "next";
import { EntityDetailHub } from "./entity-detail-hub";

export const metadata: Metadata = {
  title: "Entity — Latero Control",
};

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ fqn: string }>;
}) {
  const { fqn } = await params;
  return <EntityDetailHub entityFqn={decodeURIComponent(fqn)} />;
}
