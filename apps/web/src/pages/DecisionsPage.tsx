import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  ApiError,
  dismissDraft,
  expandDraft,
  generateDecisionDrafts,
  listDecisionDrafts,
  listDraftExpansions,
  listSignalBatches,
  promoteDraft,
  type DecisionDraft,
  type DecisionDraftExpansion,
  type SignalBatch,
} from "@/lib/api";
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
import {
  RefreshCw,
  ClipboardList,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { AuthContext } from "@/auth/AuthContext";

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

type DecisionsPageProps = {
  defaultView?: "log" | "drafts";
};

export default function DecisionsPage({ defaultView = "log" }: DecisionsPageProps) {
  const showLog = defaultView === "log";
  const showDrafts = defaultView === "drafts";
  const navigate = useNavigate();
  const { logout } = useContext(AuthContext);
  const [data, setData] = useState<DecisionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"daily" | "all">("daily");
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [drafts, setDrafts] = useState<DecisionDraft[]>([]);
  const [draftsBusy, setDraftsBusy] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [draftActionId, setDraftActionId] = useState<string | null>(null);
  const [batches, setBatches] = useState<SignalBatch[]>([]);
  const [batchesBusy, setBatchesBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [expansionFocus, setExpansionFocus] = useState<Record<string, string>>({});
  const [expansionBusy, setExpansionBusy] = useState<Record<string, boolean>>({});
  const [expansionHistoryBusy, setExpansionHistoryBusy] = useState<Record<string, boolean>>({});
  const [expansionsByDraft, setExpansionsByDraft] = useState<
    Record<string, DecisionDraftExpansion[]>
  >({});
  const [selectedExpansionId, setSelectedExpansionId] = useState<Record<string, string>>({});
  const [expandedDrafts, setExpandedDrafts] = useState<Record<string, boolean>>({});

  const handleAuthError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return true;
      }
      return false;
    },
    [logout, navigate],
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (mode === "all") {
        params.set("mode", "all");
      } else if (selectedDate) {
        params.set("date", selectedDate);
      }
      const res = await api<DecisionsResponse>(`/decisions?${params.toString()}`);
      setData(res);
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [handleAuthError, mode, selectedDate]);

  const loadDrafts = useCallback(async () => {
    if (mode === "all") {
      setDrafts([]);
      setDraftsBusy(false);
      setDraftsError(null);
      return;
    }
    setDraftsBusy(true);
    setDraftsError(null);
    try {
      const response = await listDecisionDrafts({ date: selectedDate, status: "NEW" });
      setDrafts(response.drafts);
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setDraftsError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setDraftsBusy(false);
    }
  }, [handleAuthError, mode, selectedDate]);

  useEffect(() => {
    if (!showLog) return;
    void load();
  }, [load, showLog]);

  useEffect(() => {
    if (!showDrafts) return;
    void loadDrafts();
  }, [loadDrafts, showDrafts]);

  const loadBatches = useCallback(async () => {
    setBatchesBusy(true);
    try {
      const response = await listSignalBatches();
      setBatches(response.batches);
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setDraftsError(e instanceof Error ? e.message : "Failed to load batches");
    } finally {
      setBatchesBusy(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    if (!showDrafts) return;
    void loadBatches();
  }, [loadBatches, showDrafts]);

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
      if (handleAuthError(e)) return;
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss(draftId: string) {
    setDraftActionId(draftId);
    try {
      await dismissDraft(draftId);
      await loadDrafts();
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setDraftsError(e instanceof Error ? e.message : "Failed to dismiss draft");
    } finally {
      setDraftActionId(null);
    }
  }

  async function handlePromote(draftId: string) {
    setDraftActionId(draftId);
    try {
      await promoteDraft(draftId);
      await Promise.all([load(), loadDrafts()]);
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setDraftsError(e instanceof Error ? e.message : "Failed to promote draft");
    } finally {
      setDraftActionId(null);
    }
  }

  async function handleGenerateDrafts() {
    const latestBatch = batches[0];
    if (!latestBatch) return;
    setGenerateBusy(true);
    setDraftsError(null);
    try {
      await generateDecisionDrafts({ batchId: latestBatch.id });
      await loadDrafts();
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setDraftsError(e instanceof Error ? e.message : "Failed to generate drafts");
    } finally {
      setGenerateBusy(false);
    }
  }

  async function handleExpandDraft(draftId: string) {
    setExpansionBusy((prev) => ({ ...prev, [draftId]: true }));
    setDraftsError(null);
    try {
      const response = await expandDraft(draftId, {
        focus: expansionFocus[draftId]?.trim() || undefined,
        kind: "EXPAND",
      });
      setDrafts((prev) =>
        prev.map((item) => (item.id === draftId ? response.draft : item)),
      );
      setExpansionsByDraft((prev) => {
        const existing = prev[draftId] ?? [];
        return { ...prev, [draftId]: [response.expansion, ...existing] };
      });
      setSelectedExpansionId((prev) => ({ ...prev, [draftId]: response.expansion.id }));
      setExpandedDrafts((prev) => ({ ...prev, [draftId]: true }));
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setDraftsError(e instanceof Error ? e.message : "Failed to expand draft");
    } finally {
      setExpansionBusy((prev) => ({ ...prev, [draftId]: false }));
    }
  }

  async function handleLoadExpansionHistory(draftId: string) {
    setExpansionHistoryBusy((prev) => ({ ...prev, [draftId]: true }));
    try {
      const response = await listDraftExpansions(draftId);
      setExpansionsByDraft((prev) => ({ ...prev, [draftId]: response.items }));
      if (response.items.length > 0) {
        setSelectedExpansionId((prev) => ({
          ...prev,
          [draftId]: prev[draftId] ?? response.items[0].id,
        }));
        setExpandedDrafts((prev) => ({ ...prev, [draftId]: true }));
      }
    } catch (e: unknown) {
      if (handleAuthError(e)) return;
      setDraftsError(e instanceof Error ? e.message : "Failed to load expansion history");
    } finally {
      setExpansionHistoryBusy((prev) => ({ ...prev, [draftId]: false }));
    }
  }

  function shiftDate(days: number) {
    const base = selectedDate ? parseISO(selectedDate) : new Date();
    const next = addDays(base, days);
    setSelectedDate(format(next, "yyyy-MM-dd"));
    setMode("daily");
  }

  const decisions = data?.decisions ?? [];
  const hasDayFilter = mode !== "all";
  const emptyTitle = hasDayFilter ? "No decisions for this day" : "No decisions yet";
  const emptyDescription = hasDayFilter
    ? "Try another date or switch to all time."
    : "Decisions you create from SEO Focus will appear here.";
  const hasBatches = batches.length > 0;
  const latestBatch = batches[0];

  // Group decisions by status for summary
  const statusCounts = decisions.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title={showDrafts ? "Decision Drafts" : "Decision Log"} 
        description={
          showDrafts
            ? "Review signal-driven drafts before promoting to the log."
            : "Track and manage your product decisions"
        }
      >
        {showLog && (
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
        )}
        {showDrafts && (
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerateDrafts}
            disabled={!latestBatch || generateBusy}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${generateBusy ? "animate-spin" : ""}`} />
            Generate drafts from latest batch
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {showLog && (
          <Tabs
            value={mode === "all" ? "all" : "today"}
            onValueChange={(value) => {
              if (value === "all") {
                setMode("all");
              } else {
                setMode("daily");
                setSelectedDate(format(new Date(), "yyyy-MM-dd"));
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="all">All time</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Date</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => shiftDate(-1)}
              disabled={mode === "all"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setMode("daily");
              }}
              className="w-[160px]"
              disabled={mode === "all"}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => shiftDate(1)}
              disabled={mode === "all"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedDate(format(new Date(), "yyyy-MM-dd"));
              setMode("daily");
            }}
            disabled={mode === "all"}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {showLog && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Total" value={decisions.length} />
          <SummaryCard label="Planned" value={statusCounts.PLANNED || 0} variant="info" />
          <SummaryCard label="Executed" value={statusCounts.EXECUTED || 0} variant="success" />
          <SummaryCard label="Measured" value={statusCounts.MEASURED || 0} variant="primary" />
        </div>
      )}

      {/* Error state */}
      {showLog && error && <ErrorState message={error} onRetry={load} />}

      {/* Loading state */}
      {showLog && busy && !data && <LoadingState message="Loading decisions..." />}

      {showDrafts && mode !== "all" && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Inbox</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(draftsBusy || batchesBusy) && <LoadingState message="Loading drafts..." />}
            {!draftsBusy && !batchesBusy && draftsError && (
              <div className="p-6">
                <ErrorState message={draftsError} onRetry={loadDrafts} />
              </div>
            )}
            {!draftsBusy && !batchesBusy && !draftsError && !hasBatches && (
              <div className="p-6">
                <EmptyState
                  title="No signals yet"
                  description="Upload a CSV to generate signal-driven drafts."
                  icon={<Inbox className="h-6 w-6 text-muted-foreground" />}
                />
              </div>
            )}
            {!draftsBusy && !batchesBusy && !draftsError && hasBatches && drafts.length === 0 && (
              <div className="p-6">
                <EmptyState
                  title="No drafts yet"
                  description="Generate drafts from the latest signal batch to review them here."
                  icon={<Inbox className="h-6 w-6 text-muted-foreground" />}
                />
              </div>
            )}
            {!draftsBusy && !batchesBusy && !draftsError && drafts.length > 0 && (
              <div className="divide-y divide-border">
                {drafts.map((draft) => {
                  const expansions = expansionsByDraft[draft.id] ?? [];
                  const selectedId = selectedExpansionId[draft.id];
                  const selectedExpansion =
                    expansions.find((item) => item.id === selectedId) ?? expansions[0];
                  const selectedIndex = selectedExpansion
                    ? expansions.findIndex((item) => item.id === selectedExpansion.id)
                    : -1;
                  const expansionNumber =
                    selectedIndex >= 0
                      ? (draft.expansionsCount ?? expansions.length) - selectedIndex
                      : null;
                  const isExpanded = expandedDrafts[draft.id] ?? false;

                  return (
                  <div key={draft.id} className="p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold">{draft.title}</h3>
                        <div className="flex flex-wrap gap-2">
                          {draft.keywords.map((keyword) => (
                            <span
                              key={`${draft.id}-${keyword}`}
                              className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Why now</p>
                        <p>{draft.whyNow}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Risk notes</p>
                        <p>{draft.riskNotes}</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Next steps
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {draft.nextSteps.map((action, index) => (
                          <li key={`${draft.id}-action-${index}`}>{action}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {draft.signalIds.length} signals · Batch {draft.sourceBatchId ?? "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          placeholder="Focus (optional)"
                          value={expansionFocus[draft.id] ?? ""}
                          onChange={(event) =>
                            setExpansionFocus((prev) => ({
                              ...prev,
                              [draft.id]: event.target.value,
                            }))
                          }
                          className="h-8 w-[200px]"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExpandDraft(draft.id)}
                          disabled={expansionBusy[draft.id]}
                        >
                          {expansionBusy[draft.id] ? "Expanding..." : "Expand"}
                        </Button>
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
                          Promote → SEO Focus
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Draft expansions
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {draft.expansionsCount ?? expansions.length} total ·{" "}
                            {draft.lastExpandedAt
                              ? `Last expanded ${format(
                                  new Date(draft.lastExpandedAt),
                                  "MMM d, yyyy",
                                )}`
                              : "No expansions yet"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadExpansionHistory(draft.id)}
                            disabled={expansionHistoryBusy[draft.id]}
                          >
                            {expansionHistoryBusy[draft.id] ? "Loading..." : "View history"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedDrafts((prev) => ({
                                ...prev,
                                [draft.id]: !isExpanded,
                              }))
                            }
                          >
                            {isExpanded ? "Hide" : "Show"}
                          </Button>
                          {expansions.length > 0 && (
                            <Select
                              value={selectedExpansion?.id}
                              onValueChange={(value) =>
                                setSelectedExpansionId((prev) => ({
                                  ...prev,
                                  [draft.id]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[200px]">
                                <SelectValue placeholder="Select expansion" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                                {expansions.map((item, index) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    Expansion{" "}
                                    {(draft.expansionsCount ?? expansions.length) - index}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      {isExpanded && selectedExpansion && (
                        <div className="mt-4 space-y-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-foreground">
                              Expansion {expansionNumber ?? 1}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(selectedExpansion.createdAt), "MMM d, yyyy")} ·{" "}
                              {selectedExpansion.provider ?? "provider"}{" "}
                              {selectedExpansion.model ? `(${selectedExpansion.model})` : ""}
                            </p>
                          </div>
                          <ExpansionDetails responseJson={selectedExpansion.responseJson} />
                        </div>
                      )}
                      {isExpanded && !selectedExpansion && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Expand this draft to see structured execution details.
                        </p>
                      )}
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decisions table */}
      {showLog && !busy && !error && (
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

type ExpansionResponse = {
  expanded: {
    objective: string;
    checklist: string[];
    seo: {
      titleIdeas: string[];
      tagIdeas: string[];
      descriptionBullets: string[];
    };
    assetsNeeded: string[];
    twoWeekPlan: { week1: string[]; week2: string[] };
    risks: string[];
    successMetrics: string[];
  };
};

function ExpansionDetails({ responseJson }: { responseJson: unknown }) {
  const data = responseJson as ExpansionResponse;
  if (!data?.expanded) {
    return (
      <p className="text-xs text-muted-foreground">
        Expansion data unavailable. Try re-expanding this draft.
      </p>
    );
  }

  const { expanded } = data;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Objective</p>
        <p className="text-sm text-muted-foreground">{expanded.objective}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Checklist</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {expanded.checklist.map((item, index) => (
            <li key={`check-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">SEO</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Title ideas</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {expanded.seo.titleIdeas.map((item, index) => (
                <li key={`title-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Tag ideas</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {expanded.seo.tagIdeas.map((item, index) => (
                <li key={`tag-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Description bullets</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {expanded.seo.descriptionBullets.map((item, index) => (
                <li key={`desc-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Assets needed</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {expanded.assetsNeeded.map((item, index) => (
              <li key={`asset-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Risks</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {expanded.risks.map((item, index) => (
              <li key={`risk-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Week 1 plan</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {expanded.twoWeekPlan.week1.map((item, index) => (
              <li key={`week1-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Week 2 plan</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {expanded.twoWeekPlan.week2.map((item, index) => (
              <li key={`week2-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Success metrics</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {expanded.successMetrics.map((item, index) => (
            <li key={`metric-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
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
