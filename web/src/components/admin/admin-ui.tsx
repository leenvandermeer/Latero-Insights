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
  return (
    <div
      className="rounded-[28px] border px-6 py-6 md:px-8"
      style={{
        background:
          "radial-gradient(circle at 10% 10%, rgba(200,137,42,0.14), transparent 32%), radial-gradient(circle at 88% 82%, rgba(27,59,107,0.12), transparent 42%), var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-subtle)" }}>
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-[28px] font-semibold leading-tight" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
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
      className={`rounded-3xl border ${className}`}
      style={{
        background: "var(--color-card)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
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
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
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
      className="rounded-2xl border px-4 py-4"
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
      className="group rounded-2xl border p-4 transition-transform hover:-translate-y-0.5"
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
