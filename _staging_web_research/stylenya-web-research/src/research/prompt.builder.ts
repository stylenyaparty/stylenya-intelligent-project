export type Evidence = {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  publishedAt: string | null;
  query: string;
};

export type ResearchPromptInput = {
  prompt: string;
  mode: "quick" | "deep";
  market: string;
  language: string;
  topic?: "seasonal" | "product" | "supplier" | "general";
  evidence: Evidence[];
};

export function buildResearchPrompt(input: ResearchPromptInput): string {
  const maxRows = input.mode === "deep" ? 25 : 12;
  const maxClusters = input.mode === "deep" ? 7 : 4;

  const evidencePayload = input.evidence.map((e) => ({
    url: e.url,
    domain: e.domain,
    title: e.title,
    snippet: e.snippet,
    publishedAt: e.publishedAt,
    query: e.query,
  }));

  return `
You are an analytical research engine for party decorations.

Rules:
- Use ONLY the provided evidence.
- Do NOT invent search volume or external metrics.
- Output strictly valid JSON only. No markdown. No extra text.
- Keep clusters actionable for an e-commerce seller.
- Prefer long-tail (3–6 words) and product-adjacent phrases. Avoid single adjectives.
- Avoid single-word or overly generic terms (e.g., “textures”, “blush pink” alone).
- Ensure each cluster has 2–7 keywords (deep) or 2–5 (quick).
- Deep mode: target 5–7 clusters; minimum 3 clusters when evidence is non-empty.
- Order keywords within each cluster by strongest evidence/mentions.
- Evidence titles MUST be non-empty. If a source title is missing/unclear, use the domain as the title.
- If evidence is non-empty, return at least 8 rows (quick) / 15 rows (deep).
- Deep mode MUST use at least 3 distinct cluster names across rows when evidence is non-empty.
- Quick mode MUST produce 2–4 clusters.
- Do not output 1 cluster unless evidence is empty.
- If not enough distinct long-tail keywords, include variations (synonyms/order changes) derived from evidence titles/snippets.
- Do not assign all rows to one cluster; distribute rows across clusters.

Context:
- Prompt: ${input.prompt}
- Topic: ${input.topic ?? "general"}
- Market: ${input.market}
- Language: ${input.language ?? "en"}
- Mode: ${input.mode}

Evidence (JSON):
${JSON.stringify(evidencePayload, null, 2)}

Task:
1) Extract keyword candidates relevant to party decorations and the prompt.
2) Normalize keywords (lowercase, trimmed), deduplicate.
3) Cluster into semantic groups (${input.mode === "deep" ? "3–7" : "2–4"} clusters).
4) Intent per keyword: buying|inspiration|diy|informational|supplier.
5) mentions: count approximate occurrences across evidence titles/snippets.
6) recencyScore: 0..1 (recent higher; unknown=0.5).
7) researchScore: MUST be 0 (placeholder). Do not compute it.
8) For each cluster, propose 1–3 actions (P0/P1/P2).
9) Attach topEvidence per row and per cluster (max 2 each).
10) Include a resultBundle summarizing overall findings and next steps.

Output JSON ONLY in this exact shape:
{
  "rows": [
    {
      "rowId": "string",
      "cluster": "string",
      "keyword": "string",
      "intent": "buying|inspiration|diy|informational|supplier",
      "mentions": number,
      "recencyScore": number,
      "researchScore": 0,
      "sourcesCount": number,
      "domainsCount": number,
      "topEvidence": [
        { "url": "string", "title": "string", "snippet": "string", "publishedAt": "string|null" }
      ]
    }
  ],
  "clusterBundles": [
    {
      "cluster": "string",
      "topKeywords": ["string"],
      "recommendedActions": [
        { "title": "string", "priority": "P0|P1|P2" }
      ],
      "topEvidence": [
        { "url": "string", "title": "string" }
      ]
    }
  ],
  "resultBundle": {
    "title": "string",
    "summary": "string",
    "nextSteps": ["string"],
    "sources": [
      { "url": "string", "title": "string" }
    ]
  }
}

Constraints:
- rows length <= ${maxRows}
- clusterBundles length <= ${maxClusters}
- topKeywords per cluster <= 5
- topEvidence per row <= 2
- topEvidence per cluster <= 2
- recommendedActions per cluster <= 3
- resultBundle.nextSteps length <= 7
- resultBundle.sources length <= 7
- if evidence array length > 0:
  deep: rows length >= 15 and clusterBundles length >= 3
  quick: rows length >= 8 and clusterBundles length >= 2
- publishedAt must be a string (any date format) OR null. If unknown, use null.
`.trim();
}