import type { Metadata } from "next";
import { ProductRegistry } from "./product-registry";

export const metadata: Metadata = {
  title: "Products — Latero Control",
};

export default function ProductsPage() {
  return <ProductRegistry />;
}
