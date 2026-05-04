import type { Metadata } from "next";
import { DatasetRegistry } from "./dataset-registry";

export const metadata: Metadata = {
  title: "Datasets — Latero Control",
};

export default function DatasetsPage() {
  return <DatasetRegistry />;
}
