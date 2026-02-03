import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/dashboard";
import { RefreshCw, Plus, Play, Tags, FolderSearch, Info, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

type KeywordSeed = {
  id: string;
  term: string;
  source: "CUSTOM" | "AUTO";
  status: "ACTIVE" | "ARCHIVED";
  tagsJson?: unknown;
  createdAt: string;
};

type KeywordJob = {
  id: string;
  mode: "CUSTOM" | "AUTO" | "HYBRID" | "AI";
  marketplace: "ETSY" | "SHOPIFY" | "GOOGLE";
  language: "en" | "es";
  engine: string;
  country: string;
  maxResults: number;
  providerUsed: "TRENDS" | "AUTO" | "GOOGLE_ADS" | string;
  niche: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  archivedAt?: string | null;
  createdAt: string;
};

type KeywordJobItem = {
  id: string;
  term: string;
  source: "CUSTOM" | "AUTO" | "HYBRID" | "AI";
  status: "PENDING" | "DONE" | "FAILED";
  resultJson?: {
    summary?: string;
    interestScore?: number;
    competitionScore?: number;
    relatedKeywords?: string[];
  } | null;
};

type SeedResponse = {
  ok: boolean;
  seeds: KeywordSeed[];
};

type SeedCountResponse = {
  count: number;
};

type SeedCreateResponse = {
  ok: boolean;
  created: KeywordSeed[];
  existing: KeywordSeed[];
};

type JobResponse = {
  ok: boolean;
  jobs: KeywordJob[];
};

type JobCreateResponse = {
  ok: boolean;
  job: KeywordJob;
  items: KeywordJobItem[];
};

type JobItemsResponse = {
  ok: boolean;
  items: KeywordJobItem[];
};

type JobRunResponse = {
  ok: boolean;
  job: KeywordJob;
  items: KeywordJobItem[];
  seedCount?: number;
  keywordsGenerated?: number;
  itemsPersisted?: number;
  warning?: string;
};

type PromotedSignal = {
  id: string;
  jobItemId: string;
  keyword: string;
  engine: string;
  language: string;
  country: string;
  priority: "LOW" | "MED" | "HIGH";
  promotedAt: string;
  interestScore?: number | null;
  competitionScore?: number | null;
};

type PromotedSignalsResponse = {
  ok: boolean;
  signals: PromotedSignal[];
};

type JobStatusFilter = "active" | "archived" | "all";

type KeywordProviderSettings = {
  trends: { enabled: boolean };
  googleAds: { enabled: boolean; configured: boolean; customerId?: string };
  auto: { prefers: string };
};

export default function KeywordsPage() {
  const defaultJobProviderUsed = "TRENDS";
  const defaultJobMaxResults = 10;

  const [activeTab, setActiveTab] = useState("seeds");
  const [seedInput, setSeedInput] = useState("");
  const [seeds, setSeeds] = useState<KeywordSeed[]>([]);
  const [jobs, setJobs] = useState<KeywordJob[]>([]);
  const [items, setItems] = useState<KeywordJobItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatusFilter>("active");
  const [jobActionId, setJobActionId] = useState<string | null>(null);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingPromoted, setLoadingPromoted] = useState(false);
  const [runningJobIds, setRunningJobIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [promotedSignals, setPromotedSignals] = useState<PromotedSignal[]>([]);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [seedCount, setSeedCount] = useState<number | null>(null);
  const [providerSettings, setProviderSettings] = useState<KeywordProviderSettings | null>(null);

  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobMode, setJobMode] = useState<KeywordJob["mode"]>("AUTO");
  const [jobMarketplace, setJobMarketplace] = useState<KeywordJob["marketplace"]>("ETSY");
  const [jobLanguage, setJobLanguage] = useState<KeywordJob["language"]>("en");
  const [jobCountry, setJobCountry] = useState("");
  const [jobNiche, setJobNiche] = useState("");
  const [jobOccasion, setJobOccasion] = useState("");
  const [jobProductType, setJobProductType] = useState("");
  const [jobAudience, setJobAudience] = useState("");
  const [jobSeedIds, setJobSeedIds] = useState<string[]>([]);
  const [jobProviderUsed, setJobProviderUsed] = useState(defaultJobProviderUsed);
  const [jobMaxResults, setJobMaxResults] = useState(defaultJobMaxResults);
  const [runWarning, setRunWarning] = useState<string | null>(null);

  const activeSeeds = useMemo(
    () => seeds.filter((seed) => seed.status === "ACTIVE"),
    [seeds]
  );
  const activeSeedCount = seedCount ?? activeSeeds.length;
  const hasNoActiveSeeds = activeSeedCount === 0;

  async function loadSeeds() {
    setLoadingSeeds(true);
    setError(null);
    try {
      const [seedResponse, countResponse] = await Promise.all([
        api<SeedResponse>("/keywords/seeds"),
        api<SeedCountResponse>("/keyword-seeds/count"),
      ]);
      setSeeds(seedResponse.seeds);
      setSeedCount(countResponse.count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load seeds");
    } finally {
      setLoadingSeeds(false);
    }
  }

  async function loadProviderSettings() {
    setLoadingProviders(true);
    try {
      const res = await api<KeywordProviderSettings>("/settings/keyword-providers");
      setProviderSettings(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load provider settings");
    } finally {
      setLoadingProviders(false);
    }
  }

  async function loadJobs(statusOverride?: JobStatusFilter) {
    setLoadingJobs(true);
    setError(null);
    try {
      const status = statusOverride ?? jobStatusFilter;
      const query = status ? `?status=${status}` : "";
      const res = await api<JobResponse>(`/keywords/jobs${query}`);
      setJobs(res.jobs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setLoadingJobs(false);
    }
  }

  async function loadItems(jobId: string) {
    setLoadingItems(true);
    setError(null);
    try {
      const res = await api<JobItemsResponse>(`/keywords/jobs/${jobId}/items`);
      setItems(res.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load results");
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadPromotedSignals() {
    setLoadingPromoted(true);
    try {
      const res = await api<PromotedSignalsResponse>("/keywords/promoted");
      setPromotedSignals(res.signals);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load promoted signals");
    } finally {
      setLoadingPromoted(false);
    }
  }

  useEffect(() => {
    void loadSeeds();
    void loadPromotedSignals();
    void loadProviderSettings();
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [jobStatusFilter]);

  useEffect(() => {
    if (selectedJobId) {
      void loadItems(selectedJobId);
    }
    setRunWarning(null);
  }, [selectedJobId]);

  useEffect(() => {
    if (selectedJobId && !jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(null);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (hasNoActiveSeeds && (jobMode === "AUTO" || jobMode === "HYBRID")) {
      setJobMode("CUSTOM");
    }
  }, [hasNoActiveSeeds, jobMode]);

  async function submitSeeds() {
    const terms = seedInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (terms.length === 0) return;

    setLoadingSeeds(true);
    setError(null);
    try {
      const res = await api<SeedCreateResponse>("/keywords/seeds", {
        method: "POST",
        body: JSON.stringify({ terms }),
      });
      setSeedInput("");
      setSeeds((prev) => [...res.created, ...res.existing, ...prev]);
      await loadSeeds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create seeds");
    } finally {
      setLoadingSeeds(false);
    }
  }

  async function toggleSeedStatus(seed: KeywordSeed) {
    setLoadingSeeds(true);
    setError(null);
    try {
      await api(`/keywords/seeds/${seed.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: seed.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
        }),
      });
      await loadSeeds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update seed");
    } finally {
      setLoadingSeeds(false);
    }
  }

  async function createJob() {
    if (hasNoActiveSeeds && (jobMode === "AUTO" || jobMode === "HYBRID")) {
      setError("Create seeds before creating an AUTO or HYBRID job.");
      return;
    }
    if ((jobMode === "CUSTOM" || jobMode === "HYBRID") && jobSeedIds.length === 0) {
      setError("Select at least one seed for this mode.");
      return;
    }
    if (!jobCountry.trim()) {
      setError("Country is required (2-letter code).");
      return;
    }

    setLoadingJobs(true);
    setError(null);
    try {
      const paramsPayload =
        jobOccasion || jobProductType || jobAudience
          ? {
              occasion: jobOccasion || undefined,
              productType: jobProductType || undefined,
              audience: jobAudience || undefined,
            }
          : undefined;

      const payload = {
        mode: jobMode,
        marketplace: jobMarketplace,
        language: jobLanguage,
        country: jobCountry.trim(),
        providerUsed: jobProviderUsed,
        maxResults: jobMaxResults,
        niche: jobNiche || undefined,
        params: paramsPayload,
        seedIds: jobMode === "AUTO" ? undefined : jobSeedIds,
      };

      const res = await api<JobCreateResponse>("/keywords/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setJobDialogOpen(false);
      setJobSeedIds([]);
      setJobProviderUsed(defaultJobProviderUsed);
      setJobMaxResults(defaultJobMaxResults);
      setJobCountry("");
      setJobNiche("");
      setJobOccasion("");
      setJobProductType("");
      setJobAudience("");
      await loadJobs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setLoadingJobs(false);
    }
  }

  async function runJob(jobId: string) {
    setRunningJobIds((prev) => {
      const next = new Set(prev);
      next.add(jobId);
      return next;
    });
    setLoadingItems(true);
    setError(null);
    try {
      const result = await api<JobRunResponse>(`/keywords/jobs/${jobId}/run`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setRunWarning(result.warning ?? null);
      await loadJobs();
      if (selectedJobId === jobId) {
        await loadItems(jobId);
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.status === 503 && e.code === "PROVIDER_TEMP_BLOCKED") {
          toast.error("Google Trends temporarily blocked. Try again in 30–60 seconds.");
          return;
        }
        if (e.status === 422 && e.code === "TRENDS_NO_RESULTS") {
          toast.error(e.message || "Google Trends returned no results for this search.");
          return;
        }
        if (e.status === 409 && e.code === "JOB_ALREADY_RUNNING") {
          toast.warning("Job already running.");
          return;
        }
      }
      setError(e instanceof Error ? e.message : "Failed to run job");
    } finally {
      setLoadingItems(false);
      setRunningJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  async function archiveJob(job: KeywordJob) {
    setJobActionId(job.id);
    setError(null);
    try {
      await api(`/keywords/jobs/${job.id}/archive`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Job archived", {
        description: "The job is now in the archived list.",
      });
      await loadJobs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to archive job");
    } finally {
      setJobActionId(null);
    }
  }

  async function restoreJob(job: KeywordJob) {
    setJobActionId(job.id);
    setError(null);
    try {
      await api(`/keywords/jobs/${job.id}/restore`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success("Job restored", {
        description: "The job is active again.",
      });
      await loadJobs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to restore job");
    } finally {
      setJobActionId(null);
    }
  }

  async function promoteKeywordItem(itemId: string) {
    setPromotingId(itemId);
    setError(null);
    try {
      await api(`/keywords/job-items/${itemId}/promote`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadPromotedSignals();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to promote keyword");
    } finally {
      setPromotingId(null);
    }
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const promotedIds = useMemo(
    () => new Set(promotedSignals.map((signal) => signal.jobItemId)),
    [promotedSignals]
  );
  const googleAdsConfigured = Boolean(
    providerSettings?.googleAds.enabled && providerSettings?.googleAds.configured
  );
  const providerBadgeBase =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
  const chipBase =
    "inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground";

  const normalizeProvider = (providerUsed: string) => {
    const normalized = providerUsed.trim().toUpperCase();
    if (normalized === "AUTO") return "AUTO";
    if (normalized === "GOOGLE_ADS" || normalized === "GOOGLE-ADS") return "GOOGLE_ADS";
    return "TRENDS";
  };

  const renderProviderBadge = (providerUsed: string) => {
    const normalized = normalizeProvider(providerUsed);
    if (normalized === "AUTO") {
      return (
        <span className={`${providerBadgeBase} border-emerald-200 text-emerald-700`}>
          {googleAdsConfigured ? "AUTO (ADS)" : "AUTO (TRENDS)"}
        </span>
      );
    }
    if (normalized === "GOOGLE_ADS") {
      return (
        <span className={`${providerBadgeBase} border-indigo-200 text-indigo-700`}>
          GOOGLE ADS
        </span>
      );
    }
    return (
      <span className={`${providerBadgeBase} border-primary/30 text-primary`}>
        TRENDS
      </span>
    );
  };

  const isTrendsProvider = (providerUsed: string) => {
    const normalized = normalizeProvider(providerUsed);
    if (normalized === "AUTO") {
      return !googleAdsConfigured;
    }
    return normalized === "TRENDS";
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Keywords"
        description="Curate seed keywords and run research jobs to surface new opportunities."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void loadSeeds();
            void loadJobs();
            void loadPromotedSignals();
            void loadProviderSettings();
            if (selectedJobId) {
              void loadItems(selectedJobId);
            }
          }}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            void loadSeeds();
            void loadJobs();
            void loadPromotedSignals();
            void loadProviderSettings();
            if (selectedJobId) {
              void loadItems(selectedJobId);
            }
          }}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="seeds">Seeds</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="seeds" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Seed Library</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="seed-input">Add keywords (one per line)</Label>
                <Textarea
                  id="seed-input"
                  placeholder="Enter one keyword per line"
                  value={seedInput}
                  onChange={(event) => setSeedInput(event.target.value)}
                  rows={4}
                />
                <div className="flex items-center justify-end">
                  <Button onClick={submitSeeds} disabled={loadingSeeds || seedInput.trim() === ""}>
                    Add Seeds
                  </Button>
                </div>
              </div>

              {loadingSeeds && <LoadingState message="Loading seeds..." />}

              {!loadingSeeds && seeds.length === 0 ? (
                <EmptyState
                  title="No seeds yet"
                  description="Add custom seeds to anchor your keyword research."
                  icon={<Tags className="h-6 w-6 text-muted-foreground" />}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Keyword</TableHead>
                        <TableHead className="w-[120px]">Source</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[140px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seeds.map((seed) => (
                        <TableRow key={seed.id}>
                          <TableCell className="font-medium">{seed.term}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {seed.source}
                          </TableCell>
                          <TableCell className="text-sm">{seed.status}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleSeedStatus(seed)}
                            >
                              {seed.status === "ACTIVE" ? "Archive" : "Restore"}
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
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderSearch className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Research Jobs</CardTitle>
                </div>
                <Button onClick={() => setJobDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Job
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasNoActiveSeeds && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 text-amber-700" />
                    <span>
                      Create seeds before creating/running an AUTO or HYBRID job.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("seeds")}
                  >
                    Go to Seeds
                  </Button>
                </div>
              )}
              <Tabs
                value={jobStatusFilter}
                onValueChange={(value) => setJobStatusFilter(value as JobStatusFilter)}
              >
                <TabsList>
                  <TabsTrigger value="active">Active Jobs</TabsTrigger>
                  <TabsTrigger value="archived">Archived Jobs</TabsTrigger>
                  <TabsTrigger value="all">All Jobs</TabsTrigger>
                </TabsList>
              </Tabs>

              {loadingJobs && <LoadingState message="Loading jobs..." />}

              {!loadingJobs && jobs.length === 0 ? (
                <EmptyState
                  title={
                    jobStatusFilter === "archived"
                      ? "No archived keyword jobs"
                      : "No keyword jobs yet"
                  }
                  description={
                    jobStatusFilter === "archived"
                      ? "Archived jobs will appear here once you archive a job."
                      : "Create a job to generate keyword research in CUSTOM, AUTO, or HYBRID mode."
                  }
                  icon={<FolderSearch className="h-6 w-6 text-muted-foreground" />}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Mode</TableHead>
                          <TableHead>Marketplace</TableHead>
                          <TableHead>Language</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead>Geo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[220px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => {
                        const isArchived = Boolean(job.archivedAt);
                        const isRunning = job.status === "RUNNING";
                        const isRunPending = runningJobIds.has(job.id);
                        return (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">{job.mode}</TableCell>
                            <TableCell>{job.marketplace}</TableCell>
                            <TableCell>{job.language.toUpperCase()}</TableCell>
                            <TableCell>{renderProviderBadge(job.providerUsed)}</TableCell>
                            <TableCell>
                              <span className={chipBase}>{job.country}</span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {isArchived ? "ARCHIVED" : job.status}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedJobId(job.id);
                                  setActiveTab("results");
                                }}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => runJob(job.id)}
                                disabled={isRunning || isArchived || isRunPending}
                                className="gap-1"
                              >
                                {isRunPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Running
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-4 w-4" />
                                    Run
                                  </>
                                )}
                              </Button>
                              {isArchived ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => restoreJob(job)}
                                  disabled={jobActionId === job.id}
                                >
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => archiveJob(job)}
                                  disabled={isRunning || jobActionId === job.id}
                                >
                                  Archive
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
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <FolderSearch className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Keyword Results</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedJobId ?? ""}
                    onValueChange={(value) => setSelectedJobId(value)}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select job" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border shadow-lg">
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.mode} • {job.marketplace} • {job.language.toUpperCase()}
                          {job.archivedAt ? " • Archived" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedJob && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runJob(selectedJob.id)}
                      disabled={
                        selectedJob.status === "RUNNING" ||
                        Boolean(selectedJob.archivedAt) ||
                        runningJobIds.has(selectedJob.id)
                      }
                      className="gap-1"
                    >
                      {runningJobIds.has(selectedJob.id) ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Running
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Run
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingItems && <LoadingState message="Loading results..." />}

              {!loadingItems && !selectedJob && (
                <EmptyState
                  title="Select a job"
                  description="Choose a job to view its keyword research results."
                  icon={<FolderSearch className="h-6 w-6 text-muted-foreground" />}
                />
              )}

              {!loadingItems && selectedJob && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground/70">
                    Job Meta
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={chipBase}>Source</span>
                    {renderProviderBadge(selectedJob.providerUsed)}
                    <span className={chipBase}>Country: {selectedJob.country}</span>
                    <span className={chipBase}>Engine: {selectedJob.engine}</span>
                    <span className={chipBase}>Max: {selectedJob.maxResults}</span>
                    {selectedJob.archivedAt && (
                      <span className={`${chipBase} border-amber-200 text-amber-800`}>
                        Archived
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!loadingItems && runWarning && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 text-amber-700" />
                  <span>{runWarning}</span>
                </div>
              )}

              {!loadingItems && selectedJob && items.length === 0 ? (
                <EmptyState
                  title="No results yet"
                  description={
                    runWarning
                      ? "The last run completed without results. Check provider settings or try different seeds."
                      : "Run the job to generate keyword insights."
                  }
                  icon={<FolderSearch className="h-6 w-6 text-muted-foreground" />}
                />
              ) : null}

              {!loadingItems && selectedJob && isTrendsProvider(selectedJob.providerUsed) && (
                <div className="flex items-start gap-2 rounded-md border border-muted/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>
                    Google Trends doesn’t provide competition metrics, so Competition is
                    unavailable for these results.
                  </span>
                </div>
              )}

              {!loadingItems && selectedJob && items.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Keyword</TableHead>
                        <TableHead className="w-[110px]">Source</TableHead>
                        <TableHead className="w-[140px] text-right">Interest</TableHead>
                        <TableHead className="w-[160px] text-right">Competition</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead className="w-[140px] text-right">Related</TableHead>
                        <TableHead className="w-[160px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.term}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.source}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.resultJson?.interestScore ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.resultJson?.competitionScore ?? (
                              <span
                                title={
                                  selectedJob && isTrendsProvider(selectedJob.providerUsed)
                                    ? "Not available from Google Trends"
                                    : undefined
                                }
                              >
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[320px]">
                            <p className="line-clamp-2">
                              {item.resultJson?.summary ?? "No summary available yet."}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.resultJson?.relatedKeywords?.length ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={promotedIds.has(item.id) || promotingId === item.id || loadingPromoted}
                              onClick={() => promoteKeywordItem(item.id)}
                            >
                              {promotedIds.has(item.id) ? "Promoted" : "Promote"}
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
        </TabsContent>
      </Tabs>

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Create keyword job</DialogTitle>
            <DialogDescription>
              Choose a mode and parameters to generate keyword research items.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select value={jobMode} onValueChange={(value) => setJobMode(value as KeywordJob["mode"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg">
                  <SelectItem value="CUSTOM">CUSTOM</SelectItem>
                  <SelectItem value="AUTO" disabled={hasNoActiveSeeds}>
                    {hasNoActiveSeeds ? "AUTO (Requires seeds)" : "AUTO"}
                  </SelectItem>
                  <SelectItem value="HYBRID" disabled={hasNoActiveSeeds}>
                    {hasNoActiveSeeds ? "HYBRID (Requires seeds)" : "HYBRID"}
                  </SelectItem>
                </SelectContent>
              </Select>
              {hasNoActiveSeeds && (
                <p className="text-sm text-muted-foreground">
                  Add seeds to enable AUTO and HYBRID modes.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Marketplace</Label>
                <Select
                  value={jobMarketplace}
                  onValueChange={(value) => setJobMarketplace(value as KeywordJob["marketplace"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg">
                    <SelectItem value="ETSY">ETSY</SelectItem>
                    <SelectItem value="SHOPIFY">SHOPIFY</SelectItem>
                    <SelectItem value="GOOGLE">GOOGLE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Language</Label>
                <Select
                  value={jobLanguage}
                  onValueChange={(value) => setJobLanguage(value as KeywordJob["language"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg">
                    <SelectItem value="en">EN</SelectItem>
                    <SelectItem value="es">ES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Provider</Label>
                <Select value={jobProviderUsed} onValueChange={setJobProviderUsed}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg">
                    <SelectItem value="TRENDS">Google Trends</SelectItem>
                    <SelectItem value="AUTO">AUTO</SelectItem>
                    <SelectItem value="GOOGLE_ADS" disabled={!googleAdsConfigured}>
                      Google Ads
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {loadingProviders
                    ? "Loading provider settings..."
                    : "Google Trends is the default. Google Ads requires setup."}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="job-max-results">Max results</Label>
                <Input
                  id="job-max-results"
                  type="number"
                  min={1}
                  max={100}
                  value={jobMaxResults}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    if (!Number.isNaN(nextValue)) {
                      setJobMaxResults(Math.min(100, Math.max(1, nextValue)));
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="job-country">Country</Label>
              <Input
                id="job-country"
                value={jobCountry}
                onChange={(event) => setJobCountry(event.target.value)}
                placeholder="2-letter code"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="job-niche">Niche</Label>
              <Input
                id="job-niche"
                value={jobNiche}
                onChange={(event) => setJobNiche(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Occasion</Label>
                <Input
                  value={jobOccasion}
                  onChange={(event) => setJobOccasion(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label>Product type</Label>
                <Input
                  value={jobProductType}
                  onChange={(event) => setJobProductType(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label>Audience</Label>
                <Input
                  value={jobAudience}
                  onChange={(event) => setJobAudience(event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            {(jobMode === "CUSTOM" || jobMode === "HYBRID") && (
              <div className="grid gap-2">
                <Label>Seed selection</Label>
                <div className="grid gap-2 border rounded-md p-3 max-h-[180px] overflow-y-auto">
                  {activeSeeds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add seeds to enable CUSTOM or HYBRID mode.
                    </p>
                  ) : (
                    activeSeeds.map((seed) => (
                      <label key={seed.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={jobSeedIds.includes(seed.id)}
                          onCheckedChange={(checked) => {
                            setJobSeedIds((prev) =>
                              checked
                                ? [...prev, seed.id]
                                : prev.filter((id) => id !== seed.id)
                            );
                          }}
                        />
                        <span>{seed.term}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setJobDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createJob} disabled={loadingJobs}>
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
