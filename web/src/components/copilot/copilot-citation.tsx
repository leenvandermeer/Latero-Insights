"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface CitationProps {
  label: string;
  href?: string;
}

export function CopilotCitation({ label, href }: CitationProps) {
  if (!href) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
        style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:underline"
      style={{ background: "#dbeafe", color: "#1d4ed8" }}>
      {label}
      <ExternalLink className="h-2.5 w-2.5" />
    </Link>
  );
}
