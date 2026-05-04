import { redirect } from "next/navigation";

export default async function EntityLineagePage({
  params,
}: {
  params: Promise<{ fqn: string }>;
}) {
  const { fqn } = await params;
  redirect(`/lineage?entity_fqn=${encodeURIComponent(fqn)}`);
}
