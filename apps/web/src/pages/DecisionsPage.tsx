import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageHeader,
  ActionBadge,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  type DecisionStatus,
} from "@/components/dashboard";
import type { ActionType } from "@/components/dashboard/ActionBadge";
import { RefreshCw, ClipboardList, Calendar } from "lucide-react";
import { format } from "date-fns";

type Decision = {
  id: string;
  actionType: ActionType | string;
  status: DecisionStatus;
  targetType?: "KEYWORD" | "PRODUCT" | "THEME" | null;
  targetId?: string | null;
  title: string;
  rationale?: string | null;
  priorityScore?: number | null;
  sources?: unknown;
  createdAt: string;
};

type DecisionsResponse = {
  ok: boolean;
  limit: number;
  decisions: Decision[];
};

export default function DecisionsPage() {
  const [data, setData] = useState<DecisionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<"today" | "all">("today");
  const [selectedDate, setSelectedDate] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (selectedDate) {
        params.set("date", selectedDate);
      } else {
        params.set("range", range);
      }
      const res = await api<DecisionsResponse>(`/decisions?${params.toString()}`);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [range, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: DecisionStatus) {
    setBusy(true);
    setError(null);
    try {
      await api(`/decisions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  const decisions = data?.decisions ?? [];
  const hasDayFilter = Boolean(selectedDate) || range === "today";
  const emptyTitle = hasDayFilter ? "No decisions for this day" : "No decisions yet";
  const emptyDescription = hasDayFilter
    ? "Try another date or switch to all time."
    : "Decisions you create from Weekly Focus will appear here.";

  // Group decisions by status for summary
  const statusCounts = decisions.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Decision Log" 
        description="Track and manage your product decisions"
      >
        <Button 
          variant="outline" 
          size="sm" 
          onClick={load} 
          disabled={busy}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Tabs
          value={range}
          onValueChange={(value) => {
            setRange(value as "today" | "all");
            setSelectedDate("");
          }}
        >
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="all">All time</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Date</span>
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-[160px]"
          />
          {selectedDate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedDate("");
                setRange("today");
              }}
            >
              Clear date
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total" value={decisions.length} />
        <SummaryCard label="Planned" value={statusCounts.PLANNED || 0} variant="info" />
        <SummaryCard label="Executed" value={statusCounts.EXECUTED || 0} variant="success" />
        <SummaryCard label="Measured" value={statusCounts.MEASURED || 0} variant="primary" />
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={load} />}

      {/* Loading state */}
      {busy && !data && <LoadingState message="Loading decisions..." />}

      {/* Decisions table */}
      {!busy && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">All Decisions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {decisions.length === 0 ? (
              <div className="p-6">
                <EmptyState 
                  title={emptyTitle}
                  description={emptyDescription}
                  icon={<ClipboardList className="h-6 w-6 text-muted-foreground" />}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[140px]">Date</TableHead>
                      <TableHead className="w-[200px]">Title</TableHead>
                      <TableHead className="w-[120px]">Action</TableHead>
                      <TableHead className="w-[160px]">Target</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead>Rationale</TableHead>
                      <TableHead className="w-[90px] text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decisions.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(d.createdAt), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(d.createdAt), "HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{d.title}</div>
                        </TableCell>
                        <TableCell>
                          <ActionBadge
                            action={isActionType(d.actionType) ? d.actionType : "KEEP"}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.targetType
                            ? `${d.targetType}${d.targetId ? `: ${d.targetId}` : ""}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={d.status} 
                            onValueChange={(value) => updateStatus(d.id, value as DecisionStatus)}
                            disabled={busy}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border border-border shadow-lg z-50">
                              <SelectItem value="PLANNED">
                                <StatusBadge status="PLANNED" />
                              </SelectItem>
                              <SelectItem value="EXECUTED">
                                <StatusBadge status="EXECUTED" />
                              </SelectItem>
                              <SelectItem value="MEASURED">
                                <StatusBadge status="MEASURED" />
                              </SelectItem>
                              <SelectItem value="CANCELLED">
                                <StatusBadge status="CANCELLED" />
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px]">
                          <p className="line-clamp-2">{d.rationale || "—"}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground font-mono">
                          {d.priorityScore ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const ACTION_TYPES: ActionType[] = [
  "MIGRATE",
  "BOOST",
  "RETIRE",
  "PAUSE",
  "KEEP",
  "PROMOTE",
  "CREATE",
  "OPTIMIZE",
];

function isActionType(value: string): value is ActionType {
  return ACTION_TYPES.includes(value as ActionType);
}

// Summary card component
function SummaryCard({ 
  label, 
  value, 
  variant = "default" 
}: { 
  label: string; 
  value: number; 
  variant?: "default" | "info" | "success" | "primary" 
}) {
  const variantClasses = {
    default: "bg-card border-border",
    info: "bg-info/10 border-info/20",
    success: "bg-success/10 border-success/20",
    primary: "bg-primary/10 border-primary/20",
  };

  return (
    <div className={`rounded-lg border p-3 ${variantClasses[variant]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
