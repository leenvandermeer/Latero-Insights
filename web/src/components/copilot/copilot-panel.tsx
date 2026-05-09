"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, X, Send, RotateCcw } from "lucide-react";
import { CopilotChat } from "./copilot-chat";
import { SuggestedQueries } from "./suggested-queries";
import { useCopilot } from "@/hooks/use-copilot";

export function CopilotPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, sendQuery, isLoading, suggestedQueries, clearMessages } = useCopilot();

  // Cmd+K / Ctrl+K to open
  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleSend = () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    sendQuery(q);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium md:flex hidden"
        style={{ background: "var(--color-brand)", color: "#fff" }}
        title="Open Copilot (Cmd+K)"
      >
        <Bot className="h-4 w-4" />
        Copilot
        <span className="text-[10px] opacity-70 ml-1">⌘K</span>
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-sm shadow-2xl"
            style={{ background: "var(--color-bg)", borderLeft: "1px solid var(--color-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" style={{ color: "var(--color-brand)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  Latero Copilot
                </span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={clearMessages} className="p-1.5 rounded hover:opacity-70"
                    title="Clear conversation">
                    <RotateCcw className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:opacity-70">
                  <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                </button>
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-hidden flex flex-col px-4">
              <CopilotChat messages={messages} isLoading={isLoading} />

              {/* Suggestions when empty */}
              {messages.length === 0 && (
                <div className="pb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-2"
                    style={{ color: "var(--color-text-muted)" }}>
                    Suggested
                  </p>
                  <SuggestedQueries
                    queries={suggestedQueries}
                    onSelect={(q) => { setInput(q); setTimeout(() => handleSend(), 10); }}
                  />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask about your data estate…"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--color-text)" }}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-1 rounded disabled:opacity-40"
                  style={{ color: "var(--color-brand)" }}
                >
                  {isLoading ? (
                    <span className="text-xs">…</span>
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
