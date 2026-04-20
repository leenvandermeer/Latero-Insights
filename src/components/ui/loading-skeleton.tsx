import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function CounterCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm h-full flex flex-col justify-center">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-3 h-4 w-32" />
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 shadow-sm", className)}>
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border last:border-0 px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
