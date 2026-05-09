import type { Metadata } from "next";
import { GlossaryHub } from "./glossary-hub";

export const metadata: Metadata = {
  title: "Glossary — Latero Control",
};

export default function GlossaryPage() {
  return <GlossaryHub />;
}
