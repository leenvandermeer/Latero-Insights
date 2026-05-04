import type { Metadata } from "next";
import { EntityRegistry } from "./entity-registry";

export const metadata: Metadata = {
  title: "Entities — Latero Control",
};

export default function EntitiesPage() {
  return <EntityRegistry />;
}
