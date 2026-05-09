"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ label: string; href?: string }>;
  navigation_links?: Array<{ label: string; href: string }>;
  intent_type?: string;
}

interface QueryResponse {
  data: {
    answer: string;
    citations: Array<{ label: string; href?: string }>;
    navigation_links: Array<{ label: string; href: string }>;
    intent_type: string;
    confidence: number;
  };
}

export function useCopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const pathname = usePathname();

  const mutation = useMutation({
    mutationFn: async (query: string): Promise<QueryResponse> => {
      const res = await fetch("/api/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Query failed");
      return res.json() as Promise<QueryResponse>;
    },
    onSuccess: (data, query) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: query },
        {
          role: "assistant",
          content: data.data.answer,
          citations: data.data.citations,
          navigation_links: data.data.navigation_links,
          intent_type: data.data.intent_type,
        },
      ]);
    },
  });

  const suggestedQueries = getSuggestedQueries(pathname);

  return {
    messages,
    sendQuery: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
    suggestedQueries,
    clearMessages: () => setMessages([]),
  };
}

function getSuggestedQueries(pathname: string): string[] {
  if (pathname.includes("/products")) {
    return [
      "Which products have no owner assigned?",
      "Show me products with trust score below 70",
      "What are the open incidents today?",
    ];
  }
  if (pathname.includes("/compliance")) {
    return [
      "What is the current policy pass rate?",
      "Which products are failing BCBS-239 policies?",
    ];
  }
  return [
    "Show me all open incidents",
    "Which data products have compliance failures?",
    "What changed in the last week?",
  ];
}
