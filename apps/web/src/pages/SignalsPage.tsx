import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, LoadingState, EmptyState, ErrorState } from "@/components/dashboard";
import { toast } from "@/components/ui/sonner";

type SignalBatch = {
  id: string;
  source: string;
  filename?: string | null;
  status: string;
  rowCount: number;
  createdAt: string;
};

type KeywordSignal = {
  id: string;
  batchId: string;
  term: string;
  avgMonthlySearches?: number | null;
  competition?: string | null;
  topOfPageBidLow?: number | null;
  topOfPageBidHigh?: number | null;
  capturedAt: string;
  source: string;
};

type SignalBatchResponse = {
  ok: boolean;
  batches: SignalBatch[];
};

type SignalResponse = {
  ok: boolean;
  signals: KeywordSignal[];
};

type UploadResponse = {
  batch: SignalBatch;
  importedCount: number;
  skippedDuplicatesCount: number;
};

export default function SignalsPage() {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  const [batches, setBatches] = useState<SignalBatch[]>([]);
  const [signals, setSignals] = useState<KeywordSignal[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBatch = useMemo(
    () => batches.find((batch) => batch.id === activeBatchId) ?? null,
    [batches, activeBatchId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function loadBatches() {
    setLoadingBatches(true);
    setError(null);
    try {
      const response = await api<SignalBatchResponse>("/v1/signal-batches");
      setBatches(response.batches);
      if (!activeBatchId && response.batches.length > 0) {
        setActiveBatchId(response.batches[0].id);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load batches.";
      setError(message);
    } finally {
      setLoadingBatches(false);
    }
  }

  async function loadSignals(nextBatchId?: string | null) {
    setLoadingSignals(true);
    setError(null);
    try {
      const batchId = nextBatchId ?? activeBatchId;
      const params = new URLSearchParams();
      if (batchId) params.set("batchId", batchId);
      if (debouncedQuery) params.set("q", debouncedQuery);
      params.set("limit", "100");
      const response = await api<SignalResponse>(`/v1/signals?${params.toString()}`);
      setSignals(response.signals);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load signals.";
      setError(message);
    } finally {
      setLoadingSignals(false);
    }
  }

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    void loadSignals();
  }, [activeBatchId, debouncedQuery]);

  async function handleUpload() {
    if (!uploadFile) {
      toast.error("Please choose a CSV file to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch(`${API_URL}/v1/signal-batches/gkp-csv`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        let message = `Upload failed (${response.status})`;
        try {
          const body = await response.json();
          message = body.message || body.error || message;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const result = (await response.json()) as UploadResponse;
      setUploadResult(result);
      setUploadFile(null);
      setActiveBatchId(result.batch.id);
      await loadBatches();
      await loadSignals(result.batch.id);
      toast.success("Signals imported.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signals"
        description="Import keyword signals from Google Keyword Planner CSV uploads."
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload GKP CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Input
                type="file"
                accept=".csv"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>

          {uploadResult ? (
            <div className="rounded-md border border-border bg-muted p-3 text-sm">
              <div className="font-medium">Last import</div>
              <div className="text-muted-foreground">
                Imported {uploadResult.importedCount} signals · Skipped{" "}
                {uploadResult.skippedDuplicatesCount} duplicates
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBatches ? (
              <LoadingState message="Loading batches..." />
            ) : batches.length === 0 ? (
              <EmptyState title="No batches yet" description="Upload a CSV to get started." />
            ) : (
              <div className="space-y-2">
                {batches.map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => setActiveBatchId(batch.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                      activeBatchId === batch.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{batch.filename || "GKP CSV"}</span>
                      <span className="text-xs text-muted-foreground">{batch.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {batch.rowCount} rows · {new Date(batch.createdAt).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {activeBatch
                  ? `Showing signals for ${activeBatch.filename || "GKP CSV"}`
                  : "Showing latest signals"}
              </div>
              <Input
                placeholder="Search signals..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="md:max-w-sm"
              />
            </div>

            {error ? (
              <ErrorState title="Something went wrong" description={error} />
            ) : loadingSignals ? (
              <LoadingState message="Loading signals..." />
            ) : signals.length === 0 ? (
              <EmptyState title="No signals found" description="Try another batch or query." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Term</TableHead>
                    <TableHead>Avg. Monthly Searches</TableHead>
                    <TableHead>Competition</TableHead>
                    <TableHead>Bid Low</TableHead>
                    <TableHead>Bid High</TableHead>
                    <TableHead>Captured</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.map((signal) => (
                    <TableRow key={signal.id}>
                      <TableCell className="font-medium">{signal.term}</TableCell>
                      <TableCell>{signal.avgMonthlySearches ?? "-"}</TableCell>
                      <TableCell>{signal.competition ?? "-"}</TableCell>
                      <TableCell>
                        {signal.topOfPageBidLow !== null && signal.topOfPageBidLow !== undefined
                          ? signal.topOfPageBidLow.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {signal.topOfPageBidHigh !== null && signal.topOfPageBidHigh !== undefined
                          ? signal.topOfPageBidHigh.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>{new Date(signal.capturedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
