import type { Metadata } from "next";
import { DataCatalog } from "./data-catalog";

export const metadata: Metadata = {
  title: "Catalog — Latero Control",
};

export default function CatalogPage() {
  return <DataCatalog />;
}
