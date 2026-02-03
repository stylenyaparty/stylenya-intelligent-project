import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  api,
  dismissDraft,
  generateWeeklyFocusDrafts,
  getLLMStatus,
  listWeeklyFocusDrafts,
  promoteDraft,
  type DecisionDraft,
  type LLMStatus,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { toast } from "@/components/ui/sonner";

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
  dedupeKey: string;
};

type WeeklyFocusResponse = {
  ok: boolean;
  weeklyFocusId: string;
  asOf: string;
  limit: number;
  items: WeeklyFocusItem[];
};

type PlannedDecision = {
  id: string;
  dedupeKey: string;
  status: "PLANNED" | "EXECUTED" | "MEASURED" | "CANCELLED";
};

type DecisionsResponse = {
  ok: boolean;
  limit: number;
  decisions: PlannedDecision[];
};

export default function WeeklyFocusPage() {
  const [limit, setLimit] = useState("7");
  const [data, setData] = useState<WeeklyFocusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<Record<string, boolean>>({});
  const [decisionByKey, setDecisionByKey] = useState<Record<string, PlannedDecision>>({});
  const [weeklyFocusId, setWeeklyFocusId] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const [drafts, setDrafts] = useState<DecisionDraft[]>([]);
  const [draftsBusy, setDraftsBusy] = useState(false);
  const [draftsGenerating, setDraftsGenerating] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [draftActionId, setDraftActionId] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const [weeklyFocus, decisions] = await Promise.all([
        api<WeeklyFocusResponse>(`/weekly-focus?limit=${limit}`),
        api<DecisionsResponse>(`/decisions?limit=200&range=all`),
      ]);

      setData(weeklyFocus);
      setWeeklyFocusId(weeklyFocus.weeklyFocusId);
      const decisionMap = decisions.decisions.reduce<Record<string, PlannedDecision>>(
        (acc, decision) => {
          acc[decision.dedupeKey] = decision;
          return acc;
        },
        {}
      );
      setDecisionByKey(decisionMap);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) || "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [limit]);

  useEffect(() => {
    async function loadStatus() {
      try {
        const status = await getLLMStatus();
        setLlmStatus(status);
      } catch (e: unknown) {
        setLlmStatus(null);
      }
    }
    void loadStatus();
  }, []);

  useEffect(() => {
    if (weeklyFocusId) {
      void loadDrafts(weeklyFocusId);
    }
  }, [weeklyFocusId]);

  const items = useMemo(() => data?.items ?? [], [data]);

  async function loadDrafts(id: string) {
    setDraftsBusy(true);
    setDraftsError(null);
    try {
      const response = await listWeeklyFocusDrafts(id);
      setDrafts(response.drafts);
    } catch (e: unknown) {
      setDraftsError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setDraftsBusy(false);
    }
  }

  async function createDecision(item: WeeklyFocusItem) {
    const key = item.dedupeKey;
    if (creating[key] || decisionByKey[key]) return;

    setCreating((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await api<{ ok: boolean; decision: PlannedDecision }>("/decisions", {
        method: "POST",
        body: JSON.stringify({
          actionType: item.actionType,
          targetType: item.targetType,
          targetId: item.targetId,
          title: item.title,
          rationale: item.rationale,
          priorityScore: item.priorityScore,
          sources: item.sources,
        }),
      });
      setDecisionByKey((prev) => ({
        ...prev,
        [key]: response.decision,
      }));
      toast.success("Decision created", {
        description: "The action was added to the Decision Log.",
      });
    } catch (e: unknown) {
      toast.error("Failed to create decision", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setCreating((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function generateDrafts() {
    if (!weeklyFocusId) return;
    setDraftsGenerating(true);
    setDraftsError(null);
    try {
      const response = await generateWeeklyFocusDrafts(weeklyFocusId);
      setDrafts(response.drafts);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.code === "INSUFFICIENT_CONTEXT") {
          setDraftsError(
            "Not enough real data to generate drafts. Promote keyword signals or add products first."
          );
          return;
        }
        if (e.code === "LLM_NOT_CONFIGURED") {
          setDraftsError("LLM is not configured. Set the provider credentials to continue.");
          return;
        }
        if (e.code === "LLM_BAD_OUTPUT") {
          setDraftsError("The LLM returned invalid output. Please try again.");
          return;
        }
      }
      setDraftsError(e instanceof Error ? e.message : "Failed to generate drafts");
    } finally {
      setDraftsGenerating(false);
    }
  }

  async function handleDismiss(draftId: string) {
    if (!weeklyFocusId) return;
    setDraftActionId(draftId);
    try {
      await dismissDraft(draftId);
      await loadDrafts(weeklyFocusId);
    } catch (e: unknown) {
      toast.error("Failed to dismiss draft", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setDraftActionId(null);
    }
  }

  async function handlePromote(draftId: string) {
    if (!weeklyFocusId) return;
    setDraftActionId(draftId);
    try {
      await promoteDraft(draftId);
      await loadDrafts(weeklyFocusId);
      toast.success("Draft promoted", {
        description: "The decision was added to the Decision Log.",
      });
    } catch (e: unknown) {
      toast.error("Failed to promote draft", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setDraftActionId(null);
    }
  }

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
        <div className="space-y-6">
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
                        <TableHead className="w-[160px] text-right">Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => {
                        const key = item.dedupeKey;
                        const decision = decisionByKey[key];
                        const isCreating = creating[key];
                        return (
                          <TableRow
                            key={key}
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
                            <TableCell className="text-right">
                              {decision ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground opacity-80">
                                    {decision.status === "PLANNED"
                                      ? "Planned"
                                      : decision.status === "EXECUTED"
                                        ? "Executed"
                                        : decision.status === "MEASURED"
                                          ? "Measured"
                                          : "Cancelled"}
                                  </span>
                                  <a
                                    href="/dashboard/decisions"
                                    className="text-xs font-medium text-primary hover:underline"
                                  >
                                    View
                                  </a>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => createDecision(item)}
                                  disabled={isCreating}
                                >
                                  {isCreating ? "Creating..." : "Create Decision"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Decision Drafts</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateDrafts}
                  disabled={!llmStatus?.configured || draftsGenerating || !weeklyFocusId}
                >
                  {draftsGenerating ? "Generating..." : "Generate Drafts"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {llmStatus && !llmStatus.configured && (
                <Alert>
                  <AlertTitle>LLM not configured</AlertTitle>
                  <AlertDescription>
                    Configure the LLM provider to enable draft generation.
                  </AlertDescription>
                </Alert>
              )}

              {draftsError && (
                <Alert>
                  <AlertTitle>Draft generation issue</AlertTitle>
                  <AlertDescription>{draftsError}</AlertDescription>
                </Alert>
              )}

              {draftsBusy && <LoadingState message="Loading drafts..." />}

              {!draftsBusy && drafts.length === 0 ? (
                <EmptyState
                  title="No active drafts"
                  description="Generate drafts to review proposed decisions."
                  icon={<Target className="h-6 w-6 text-muted-foreground" />}
                />
              ) : (
                <div className="space-y-4">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="rounded-lg border border-border p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold">{draft.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {draft.rationale}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-semibold">
                          {draft.confidence}% confidence
                        </span>
                      </div>

                      <details className="rounded-md border border-border/60 px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          Proposed actions ({draft.actions.length})
                        </summary>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {draft.actions.map((action, index) => (
                            <li key={`${draft.id}-action-${index}`}>{action}</li>
                          ))}
                        </ul>
                      </details>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDismiss(draft.id)}
                          disabled={draftActionId === draft.id}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePromote(draft.id)}
                          disabled={draftActionId === draft.id}
                        >
                          Promote
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
