import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        success: "",
        warning: "",
        error: "",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const variantStyles: Record<string, React.CSSProperties> = {
  success: { backgroundColor: "var(--color-success-light)", color: "var(--color-success)" },
  warning: { backgroundColor: "var(--color-warning-light)", color: "var(--color-warning)" },
  error: { backgroundColor: "var(--color-error-light)", color: "var(--color-error)" },
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, style, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      style={{ ...variantStyles[variant ?? ""], ...style }}
      {...props}
    />
  );
}

/** Map run_status / check_status to badge variant */
export function statusVariant(status: string): BadgeProps["variant"] {
  switch (status.toUpperCase()) {
    case "SUCCESS":
    case "PASS":
      return "success";
    case "WARNING":
    case "WARN":
      return "warning";
    case "FAILED":
    case "FAIL":
    case "ERROR":
      return "error";
    default: return "muted";
  }
}

/** Map severity to badge variant */
export function severityVariant(severity: string): BadgeProps["variant"] {
  switch (severity.toLowerCase()) {
    case "high": return "error";
    case "medium": return "warning";
    case "low": return "success";
    default: return "muted";
  }
}
