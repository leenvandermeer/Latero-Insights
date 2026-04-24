import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CounterCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    label?: string;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function CounterCard({ label, value, trend, icon, className }: CounterCardProps) {
  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null;

  const trendColor = trend
    ? trend.value > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : trend.value < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground"
    : "";

  const trendStyle: React.CSSProperties | undefined = trend
    ? trend.value > 0
      ? { color: "var(--color-success)" }
      : trend.value < 0
        ? { color: "var(--color-error)" }
        : undefined
    : undefined;

  return (
    <Card className={cn("relative overflow-hidden card-hover cursor-default h-full flex flex-col justify-center", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-snug" style={{ color: "var(--color-text-muted)" }}>{label}</p>
          {icon && (
            <div className="shrink-0" style={{ color: "var(--color-accent)" }}>{icon}</div>
          )}
        </div>
        <p
          className="mt-2 font-display font-bold tracking-normal leading-none break-words"
          style={{ fontSize: "clamp(1.55rem, 3.2vw, 2rem)", color: "var(--color-text)" }}
        >
          {value}
        </p>
        {trend && TrendIcon && (
          <div className={cn("mt-2 flex items-center gap-1 text-sm", trendColor)} style={trendStyle}>
            <TrendIcon className="h-4 w-4" />
            <span>{Math.abs(trend.value)}%</span>
            {trend.label && (
              <span className="text-muted-foreground">{trend.label}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
