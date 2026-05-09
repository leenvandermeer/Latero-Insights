"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { Bot, User } from "lucide-react";
import { CopilotCitation } from "./copilot-citation";
import type { CopilotMessage } from "@/hooks/use-copilot";

export function CopilotChat({ messages }: { messages: CopilotMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
          Ask a question about your data estate
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-4">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
          <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: msg.role === "user" ? "var(--color-brand)" : "var(--color-surface-raised)" }}>
            {msg.role === "user"
              ? <User className="h-3.5 w-3.5 text-white" />
              : <Bot className="h-3.5 w-3.5" style={{ color: "var(--color-brand)" }} />}
          </div>
          <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className="rounded-xl px-3 py-2 text-sm"
              style={{
                background: msg.role === "user" ? "var(--color-brand)" : "var(--color-surface)",
                color: msg.role === "user" ? "#fff" : "var(--color-text)",
                border: msg.role === "assistant" ? "1px solid var(--color-border)" : "none",
              }}>
              {msg.content}
            </div>

            {msg.citations && msg.citations.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Based on:</span>
                {msg.citations.map((c, ci) => (
                  <CopilotCitation key={ci} label={c.label} href={c.href} />
                ))}
              </div>
            )}

            {msg.navigation_links && msg.navigation_links.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {msg.navigation_links.map((l, li) => (
                  <Link key={li} href={l.href}
                    className="text-xs px-2 py-0.5 rounded-full hover:opacity-80"
                    style={{ background: "var(--color-surface-raised)", color: "var(--color-brand)", border: "1px solid var(--color-border)" }}>
                    {l.label} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
