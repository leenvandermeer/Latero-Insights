import { redirect } from "next/navigation";

export default async function EntityQualityPage({
  params,
}: {
  params: Promise<{ fqn: string }>;
}) {
  const { fqn } = await params;
  redirect(`/quality?entity_fqn=${encodeURIComponent(fqn)}`);
}
