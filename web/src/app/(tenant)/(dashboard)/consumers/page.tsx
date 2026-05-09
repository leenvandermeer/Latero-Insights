import type { Metadata } from "next";
import { DemandHub } from "./demand-hub";

export const metadata: Metadata = {
  title: "Consumers — Latero Control",
};

export default function ConsumersPage() {
  return <DemandHub />;
}
