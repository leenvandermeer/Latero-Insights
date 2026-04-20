import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl mb-6 px-8 py-8", className)}
      style={{
        background: "linear-gradient(135deg, var(--color-surface) 60%, var(--color-brand-subtle) 100%)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Dot-grid texture — top right */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(75,123,181,0.13) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 60% 90% at 95% 10%, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 90% at 95% 10%, black 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && (
            <p
              className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--color-accent)", letterSpacing: "0.13em" }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-accent)",
                  marginRight: 8,
                  verticalAlign: "middle",
                  marginBottom: 2,
                }}
              />
              {eyebrow}
            </p>
          )}
          <h1
            className="font-display font-light italic leading-tight"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--color-text)", letterSpacing: "-0.02em" }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)", maxWidth: 560 }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
