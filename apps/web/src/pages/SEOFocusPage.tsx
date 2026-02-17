import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type ActionType,
  type DecisionStatus,
} from "@/components/dashboard";
import { RefreshCw, Target } from "lucide-react";

const WINDOW_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
  { label: "60 days", value: "60" },
];

type SeoFocusDecision = {
  id: string;
  title: string;
  status: DecisionStatus;
  priorityScore: number | null;
  actionType: ActionType;
  createdAt: string;
};

type SeoFocusResponse = {
  window: {
    from: string;
    to: string;
    days: number;
    includeExecuted: boolean;
  };
  items: SeoFocusDecision[];
};

export default function SEOFocusPage() {
  const [days, setDays] = useState("14");
  const [includeExecuted, setIncludeExecuted] = useState("true");
  const [data, setData] = useState<SeoFocusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const response = await api<SeoFocusResponse>(
        `/seo-focus?days=${days}&includeExecuted=${includeExecuted}`
      );
      setData(response);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [days, includeExecuted]);

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="ui-section animate-fade-in">
      <PageHeader
        title="SEO Focus"
        subtitle="Bi-weekly planner view derived from the Decision Log"
      >
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Window" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            {WINDOW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={includeExecuted} onValueChange={setIncludeExecuted}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            <SelectItem value="true">Include executed</SelectItem>
            <SelectItem value="false">Planned only</SelectItem>
          </SelectContent>
        </Select>
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

      {data?.window && (
        <p className="text-xs text-muted-foreground mb-4">
          Window: {new Date(data.window.from).toLocaleDateString()} –{" "}
          {new Date(data.window.to).toLocaleDateString()} · {data.window.days} days
        </p>
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      {busy && !data && <LoadingState message="Loading SEO focus..." />}

      {!busy && !error && (
        <div className="ui-section">
          <section className="ui-card ui-card-hover p-0">
            <div className="flex items-center gap-2 border-b border-border/70 px-6 py-4">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight">SEO Focus Decisions</h2>
            </div>
              {items.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No decisions in this window"
                    description="Decisions planned or executed in this period will appear here."
                    icon={<Target className="h-6 w-6 text-muted-foreground" />}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto animate-fade-in">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[130px]">Action</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[130px]">Status</TableHead>
                        <TableHead className="w-[90px] text-right">Score</TableHead>
                        <TableHead className="w-[180px] text-right">Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow
                          key={item.id}
                          className={idx === 0 ? "bg-primary/5" : ""}
                        >
                          <TableCell>
                            <ActionBadge action={item.actionType} />
                          </TableCell>
                          <TableCell className="font-medium">{item.title}</TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.priorityScore ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              to="/dashboard/decisions"
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Open in Decision Log
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
        </div>
      )}
    </div>
  );
}
