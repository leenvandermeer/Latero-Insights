import type { Metadata } from "next";
import { ProductDetail } from "./product-detail";

export const metadata: Metadata = {
  title: "Product — Latero Control",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetail productId={decodeURIComponent(id)} />;
}
