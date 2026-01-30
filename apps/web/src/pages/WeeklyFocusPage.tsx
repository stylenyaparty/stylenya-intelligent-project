import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type ActionType 
} from "@/components/dashboard";
import { RefreshCw, Plus, Target, TrendingUp, ShoppingBag, Calendar } from "lucide-react";

type WeeklyFocusItem = {
  productId: string;
  name: string;
  action: ActionType;
  priorityScore: number;
  why: string;
  signals: {
    inShopify: boolean;
    d90Units: number;
    d180Units: number;
    requests30d: number;
    seasonality: string;
  };
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

  // Create decision modal state
  const [selected, setSelected] = useState<WeeklyFocusItem | null>(null);
  const [rationale, setRationale] = useState("");
  const [expectedImpact, setExpectedImpact] = useState("");

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<WeeklyFocusResponse>(`/v1/recommendations/weekly-focus?limit=${limit}`);
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

  async function createDecision() {
  if (!selected) return;

  const decidedProductId = selected.productId; // guardamos antes de resetear selected
  setBusy(true);
  setError(null);

  try {
    await api(`/v1/decisions`, {
      method: "POST",
      body: JSON.stringify({
        productId: selected.productId,
        decisionType: selected.action,
        rationale: rationale || selected.why,
        expectedImpact: expectedImpact || undefined,
        engineVersion: "v1",
        engineSnapshot: selected,
      }),
    });

    // ✅ Optimistic UI: quita el item decidido de la tabla inmediatamente
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((x) => x.productId !== decidedProductId),
      };
    });

    // Reset modal
    setSelected(null);
    setRationale("");
    setExpectedImpact("");

    // Reload data (source of truth)
    //await load();
  } catch (e: unknown) {
    setError((e instanceof Error ? e.message : String(e)) || "Failed to create decision");
  } finally {
    setBusy(false);
  }
}

  function openCreateModal(item: WeeklyFocusItem) {
    setSelected(item);
    setRationale(item.why);
    setExpectedImpact("");
  }

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Weekly Focus" 
        description="Prioritized product actions based on intelligence signals"
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

      {/* Data timestamp */}
      {data?.asOf && (
        <p className="text-xs text-muted-foreground mb-4">
          Data as of: {new Date(data.asOf).toLocaleString()}
        </p>
      )}

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={load} />}

      {/* Loading state */}
      {busy && !data && <LoadingState message="Loading recommendations..." />}

      {/* Data table */}
      {!busy && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Recommended Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-6">
                <EmptyState 
                  title="No focus items" 
                  description="No prioritized actions available at this time."
                  icon={<Target className="h-6 w-6 text-muted-foreground" />}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[200px]">Product</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                      <TableHead className="w-[80px] text-right">Score</TableHead>
                      <TableHead className="w-[250px]">Signals</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow 
                        key={item.productId} 
                        className={idx === 0 ? "bg-primary/5" : ""}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {idx === 0 && (
                              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                #1
                              </span>
                            )}
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={item.action} />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.priorityScore}
                        </TableCell>
                        <TableCell>
                          <SignalPills signals={item.signals} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {item.why}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openCreateModal(item)}
                            className="gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Decide
                          </Button>
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

      {/* Create Decision Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Decision</DialogTitle>
            <DialogDescription>
              Record your decision for this product recommendation.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-2">
              {/* Product info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <ActionBadge action={selected.action} />
                <div>
                  <p className="font-medium">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Priority score: {selected.priorityScore}
                  </p>
                </div>
              </div>

              {/* Rationale */}
              <div className="space-y-2">
                <Label htmlFor="rationale">Rationale</Label>
                <Textarea
                  id="rationale"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={3}
                  placeholder="Why are you making this decision?"
                />
              </div>

              {/* Expected impact */}
              <div className="space-y-2">
                <Label htmlFor="impact">Expected Impact (optional)</Label>
                <Input
                  id="impact"
                  value={expectedImpact}
                  onChange={(e) => setExpectedImpact(e.target.value)}
                  placeholder="e.g., +20% sales in next 30 days"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSelected(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button 
              onClick={createDecision}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save Decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Signal pills component
function SignalPills({ signals }: { signals: WeeklyFocusItem["signals"] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs">
        <TrendingUp className="h-3 w-3" />
        D90: {signals.d90Units}
      </span>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs">
        <TrendingUp className="h-3 w-3" />
        D180: {signals.d180Units}
      </span>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs">
        <ShoppingBag className="h-3 w-3" />
        {signals.inShopify ? "In Shopify" : "Not in Shopify"}
      </span>
      {signals.seasonality !== "none" && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs">
          <Calendar className="h-3 w-3" />
          {signals.seasonality}
        </span>
      )}
    </div>
  );
}
