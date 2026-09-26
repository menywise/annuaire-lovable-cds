import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md border border-border bg-surface-sunken", className)} {...props} />;
}

export { Skeleton };
