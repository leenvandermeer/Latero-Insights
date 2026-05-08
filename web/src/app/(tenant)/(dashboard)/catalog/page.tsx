import type { Metadata } from "next";
import { CatalogHub } from "./catalog-hub";

export const metadata: Metadata = {
  title: "Catalog — Latero Control",
};

export default function CatalogPage() {
  return <CatalogHub />;
}
