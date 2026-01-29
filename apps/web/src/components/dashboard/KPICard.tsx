import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "highlight";
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  variant = "default",
  className 
}: KPICardProps) {
  return (
    <div 
      className={cn(
        "rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm",
        variant === "highlight" && "border-primary/20 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-card-foreground">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 pt-1">
              <span className={cn(
                "text-xs font-medium",
                trend.value > 0 ? "text-success" : trend.value < 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "p-2 rounded-lg",
            variant === "highlight" ? "bg-primary/10" : "bg-muted"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              variant === "highlight" ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
        )}
      </div>
    </div>
  );
}
