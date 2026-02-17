import { cn } from "@/lib/utils";

export type DecisionStatus =
  | "NEW"
  | "DISMISSED"
  | "PROMOTED"
  | "PLANNED"
  | "EXECUTED"
  | "MEASURED"
  | "CANCELLED";

interface StatusBadgeProps {
  status: DecisionStatus;
  className?: string;
}

const statusConfig: Record<DecisionStatus, { label: string; className: string }> = {
  NEW: {
    label: "New",
    className: "bg-primary/10 text-primary",
  },
  DISMISSED: {
    label: "Dismissed",
    className: "bg-muted text-muted-foreground",
  },
  PROMOTED: {
    label: "Promoted",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  PLANNED: {
    label: "Planned",
    className: "bg-primary/10 text-primary",
  },
  EXECUTED: {
    label: "Executed",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  MEASURED: {
    label: "Measured",
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.PLANNED;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
