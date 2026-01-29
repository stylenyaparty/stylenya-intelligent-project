import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Decision = {
  id: string;
  decisionType: string;
  status: "PLANNED" | "EXECUTED" | "MEASURED" | "CANCELLED";
  productId: string;
  rationale: string;
  expectedImpact?: string | null;
  engineVersion?: string | null;
  createdAt: string;
  product?: { name: string };
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

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<DecisionsResponse>(`/v1/decisions?limit=50`);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(id: string, status: Decision["status"]) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/decisions/${id}`, {
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

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Decisions</h2>
        <button onClick={load} disabled={busy}>Refresh</button>
      </div>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th align="left">When</th>
              <th align="left">Product</th>
              <th align="left">Type</th>
              <th align="left">Status</th>
              <th align="left">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {(data?.decisions ?? []).map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid #ddd" }}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(d.createdAt).toLocaleString()}</td>
                <td>{d.product?.name ?? d.productId}</td>
                <td><b>{d.decisionType}</b></td>
                <td>
                  <select value={d.status} onChange={(e) => updateStatus(d.id, e.target.value as Decision["status"])} disabled={busy}>
                    <option value="PLANNED">PLANNED</option>
                    <option value="EXECUTED">EXECUTED</option>
                    <option value="MEASURED">MEASURED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </td>
                <td>{d.rationale}</td>
              </tr>
            ))}
            {!busy && (data?.decisions?.length ?? 0) === 0 && (
              <tr><td colSpan={5} style={{ padding: 16, opacity: 0.7 }}>No decisions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
