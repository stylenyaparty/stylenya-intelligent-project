import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  LoadingState,
  ErrorState,
  EmptyState,
  type ActionType,
} from "@/components/dashboard";
import { RefreshCw, Target } from "lucide-react";

type WeeklyFocusItem = {
  actionType: ActionType;
  targetType: "KEYWORD" | "PRODUCT" | "THEME";
  targetId: string;
  title: string;
  rationale: string;
  priorityScore: number;
  sources: {
    keyword: string;
    signalId: string;
  }[];
};

type WeeklyFocusResponse = {
  ok: boolean;
  asOf: string;
  limit: number;
  items: WeeklyFocusItem[];
};

export default function WeeklyFocusPage() {
  const [limit, setLimit] = useState("7");
  const [data, setData] = useState<WeeklyFocusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<WeeklyFocusResponse>(`/v1/weekly-focus?limit=${limit}`);
      setData(res);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [limit]);

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Weekly Focus"
        description="Prioritized actions based on promoted keyword signals"
      >
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Limit" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            <SelectItem value="7">Top 7</SelectItem>
            <SelectItem value="10">Top 10</SelectItem>
            <SelectItem value="20">Top 20</SelectItem>
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

      {data?.asOf && (
        <p className="text-xs text-muted-foreground mb-4">
          Data as of: {new Date(data.asOf).toLocaleString()}
        </p>
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      {busy && !data && <LoadingState message="Loading weekly focus..." />}

      {!busy && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Weekly Focus Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No promoted signals yet"
                  description="Promote keywords to generate weekly actions."
                  icon={<Target className="h-6 w-6 text-muted-foreground" />}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[130px]">Action</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[90px] text-right">Score</TableHead>
                      <TableHead className="w-[200px]">Sources</TableHead>
                      <TableHead>Rationale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow
                        key={`${item.targetType}-${item.targetId}-${idx}`}
                        className={idx === 0 ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          <ActionBadge action={item.actionType} />
                        </TableCell>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.priorityScore}
                        </TableCell>
                        <TableCell>
                          <SourcePills sources={item.sources} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[320px]">
                          {item.rationale}
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

function SourcePills({ sources }: { sources: WeeklyFocusItem["sources"] }) {
  if (sources.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <span
          key={source.signalId}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs"
        >
          {source.keyword}
        </span>
      ))}
    </div>
  );
}
