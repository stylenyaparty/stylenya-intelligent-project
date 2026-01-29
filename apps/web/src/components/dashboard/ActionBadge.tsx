import { cn } from "@/lib/utils";

export type ActionType = "MIGRATE" | "BOOST" | "RETIRE" | "PAUSE" | "KEEP";

interface ActionBadgeProps {
  action: ActionType;
  className?: string;
}

const actionConfig: Record<ActionType, { label: string; className: string }> = {
  BOOST: {
    label: "Boost",
    className: "bg-action-boost/15 text-action-boost border-action-boost/30",
  },
  MIGRATE: {
    label: "Migrate",
    className: "bg-action-migrate/15 text-action-migrate border-action-migrate/30",
  },
  RETIRE: {
    label: "Retire",
    className: "bg-action-retire/15 text-action-retire border-action-retire/30",
  },
  PAUSE: {
    label: "Pause",
    className: "bg-action-pause/15 text-action-pause border-action-pause/30",
  },
  KEEP: {
    label: "Keep",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function ActionBadge({ action, className }: ActionBadgeProps) {
  const config = actionConfig[action] || actionConfig.KEEP;
  
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
