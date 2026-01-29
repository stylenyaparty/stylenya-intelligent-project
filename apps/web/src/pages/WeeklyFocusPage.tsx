import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type WeeklyFocusItem = {
  productId: string;
  name: string;
  action: "MIGRATE" | "BOOST" | "RETIRE" | "PAUSE" | "KEEP";
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
  const [limit, setLimit] = useState(7);
  const [data, setData] = useState<WeeklyFocusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create decision modal state (minimal)
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

  useEffect(() => { void load(); }, [limit]);

  const items = useMemo(() => data?.items ?? [], [data]);

  async function createDecision() {
    if (!selected) return;
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
      // reset modal
      setSelected(null);
      setRationale("");
      setExpectedImpact("");
      // optional reload
      await load();
      alert("Decision created.");
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) || "Failed to create decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Weekly Focus</h2>
        <button onClick={load} disabled={busy}>Refresh</button>

        <div style={{ marginLeft: "auto" }}>
          <label>
            Limit:&nbsp;
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={7}>7</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>
        </div>
      </div>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}
      {data && <div style={{ marginTop: 8, opacity: 0.8 }}>asOf: {data.asOf}</div>}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">Action</th>
              <th align="right">Score</th>
              <th align="left">Signals</th>
              <th align="left">Why</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.productId} style={{ borderTop: "1px solid #ddd" }}>
                <td>{it.name}</td>
                <td><b>{it.action}</b></td>
                <td align="right">{it.priorityScore}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  D90:{it.signals.d90Units} · D180:{it.signals.d180Units} · Req30:{it.signals.requests30d} · Shopify:{String(it.signals.inShopify)}
                </td>
                <td>{it.why}</td>
                <td align="right">
                  <button
                    onClick={() => {
                      setSelected(it);
                      setRationale(it.why);
                      setExpectedImpact("");
                    }}
                  >
                    Create Decision
                  </button>
                </td>
              </tr>
            ))}
            {!busy && items.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, opacity: 0.7 }}>No items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Minimal modal */}
      {selected && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}
        >
          <div style={{ background: "white", padding: 16, width: 720, maxWidth: "100%", borderRadius: 12 }}>
            <h3 style={{ marginTop: 0 }}>Create Decision</h3>
            <div style={{ opacity: 0.8, marginBottom: 10 }}>
              <b>{selected.name}</b> — {selected.action} (score {selected.priorityScore})
            </div>

            <label style={{ display: "block", marginBottom: 8 }}>
              Rationale
              <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} style={{ width: "100%" }} />
            </label>

            <label style={{ display: "block", marginBottom: 12 }}>
              Expected impact (optional)
              <input value={expectedImpact} onChange={(e) => setExpectedImpact(e.target.value)} style={{ width: "100%" }} />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setSelected(null)} disabled={busy}>Cancel</button>
              <button onClick={createDecision} disabled={busy}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
