"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  if (!description && !actions && !eyebrow) return null;

  return (
    <div className="flex flex-col gap-3 pt-1 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-subtle)" }}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold leading-tight md:hidden" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--color-text-muted)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border ${className}`}
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      {children}
    </div>
  );
}

export function AdminSectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-muted)" }}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string | number;
  meta?: string;
}) {
  return (
    <div
      className="rounded-xl border px-4 py-4"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-subtle)" }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold leading-none" style={{ color: "var(--color-text)" }}>
        {value}
      </p>
      {meta ? (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {meta}
        </p>
      ) : null}
    </div>
  );
}

export function AdminActionCard({
  href,
  title,
  text,
  icon,
}: {
  href: string;
  title: string;
  text?: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border p-4 transition-colors"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand)" }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {title}
          </p>
          {text ? (
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {text}
            </p>
          ) : null}
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
            Open
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
