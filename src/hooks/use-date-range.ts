"use client";

import { useState, useCallback } from "react";

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useDateRange(initialFrom?: string, initialTo?: string) {
  const [from, setFrom] = useState(initialFrom ?? defaultFrom);
  const [to, setTo] = useState(initialTo ?? defaultTo);

  const setRange = useCallback((newFrom: string, newTo: string) => {
    setFrom(newFrom);
    setTo(newTo);
  }, []);

  return { from, to, setRange };
}
