import { cn } from "@/lib/utils";

export type DecisionStatus = "PLANNED" | "EXECUTED" | "MEASURED" | "CANCELLED";

interface StatusBadgeProps {
  status: DecisionStatus;
  className?: string;
}

const statusConfig: Record<DecisionStatus, { label: string; className: string }> = {
  PLANNED: {
    label: "Planned",
    className: "bg-info/15 text-info border-info/30",
  },
  EXECUTED: {
    label: "Executed",
    className: "bg-success/15 text-success border-success/30",
  },
  MEASURED: {
    label: "Measured",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.PLANNED;
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
