import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/db/prisma.js";

const mockState = vi.hoisted(() => ({
  tavilyCalls: 0,
  llmCalls: 0,
  llmDelayMs: 0,
  llm429FailuresLeft: 0,
  llmAlways429: false,
}));

function deterministicBundleJson() {
  return JSON.stringify({
    rows: [
      {
        rowId: "row-1",
        cluster: "Pastel",
        keyword: "pastel birthday banner",
        intent: "buying",
        mentions: 8,
        recencyScore: 0.8,
        researchScore: 0.9,
        sourcesCount: 2,
        domainsCount: 2,
        topEvidence: [
          {
            url: "https://example.com/decor-a",
            title: "Decor A",
            snippet: "Decor A snippet",
            publishedAt: "2026-01-10",
          },
          {
            url: "https://example.org/decor-b",
            title: "Decor B",
            snippet: "Decor B snippet",
            publishedAt: "2026-01-11",
          },
        ],
      },
      {
        rowId: "row-2",
        cluster: "Neon",
        keyword: "neon party decor kit",
        intent: "inspiration",
        mentions: 5,
        recencyScore: 0.7,
        researchScore: 0.84,
        sourcesCount: 1,
        domainsCount: 1,
        topEvidence: [
          {
            url: "https://example.com/decor-a",
            title: "Decor A",
            snippet: "Decor A snippet",
            publishedAt: "2026-01-10",
          },
        ],
      },
    ],
    clusterBundles: [],
    resultBundle: {
      title: "Mocked result",
      summary: "Mocked summary",
      nextSteps: ["Ship SEO set"],
      sources: [{ url: "https://example.com/decor-a", title: "Decor A" }],
    },
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForRun(app: FastifyInstance, runId: string, timeoutMs = 1500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await app.inject({ method: "GET", url: `/v1/research/runs/${runId}` });
    if (response.statusCode === 200) {
      const body = response.json();
      if (body.status === "SUCCESS" || body.status === "FAILED") {
        return body;
      }
    }
    await wait(20);
  }

  throw new Error(`Timed out waiting for run ${runId}`);
}

vi.mock("../../src/providers/tavily.client.js", () => {
  const cache = new Map<string, unknown>();

  return {
    tavilySearchWithMeta: vi.fn(async (opts: { query: string }) => {
      const cacheEnabled = String(process.env.TAVILY_CACHE_ENABLED ?? "false") === "true";
      const key = opts.query;

      if (cacheEnabled && cache.has(key)) {
        return { results: cache.get(key), cacheHit: true };
      }

      mockState.tavilyCalls += 1;
      const results = [
        {
          url: "https://example.com/decor-a",
          title: "Decor A",
          content: "Decor A content",
          published_date: "2026-01-10",
        },
        {
          url: "https://example.org/decor-b",
          title: "Decor B",
          content: "Decor B content",
          published_date: "2026-01-11",
        },
      ];

      if (cacheEnabled) cache.set(key, results);
      return { results, cacheHit: false };
    }),
    tavilySearch: vi.fn(),
  };
});

vi.mock("../../src/providers/openai.client.js", () => {
  return {
    callOpenAIJsonWithRetry: vi.fn(async (input: { timeoutMs?: number }) => {
      mockState.llmCalls += 1;

      if (mockState.llmDelayMs > 0) {
        const timeoutMs = input.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS ?? 60_000);
        if (mockState.llmDelayMs > timeoutMs) {
          await wait(timeoutMs + 5);
          throw {
            name: "LLMTimeoutError",
            message: `LLM request timed out after ${timeoutMs}ms`,
            timeout: true,
            stage: "llm",
          };
        }

        await wait(mockState.llmDelayMs);
      }

      if (mockState.llmAlways429) {
        throw {
          name: "RateLimitError",
          message: "rate limited",
          status: 429,
          code: "rate_limit_exceeded",
          isRateLimit: true,
        };
      }

      const retryMax = Number(process.env.OPENAI_RETRY_MAX ?? 3);
      while (mockState.llm429FailuresLeft > 0) {
        mockState.llm429FailuresLeft -= 1;
        if (mockState.llmCalls > retryMax) {
          throw {
            name: "RateLimitError",
            message: "rate limited",
            status: 429,
            code: "rate_limit_exceeded",
            isRateLimit: true,
          };
        }
        mockState.llmCalls += 1;
      }

      return deterministicBundleJson();
    }),
  };
});

const { buildApp } = await import("../../src/app.js");

describe("web research integration", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockState.tavilyCalls = 0;
    mockState.llmCalls = 0;
    mockState.llmDelayMs = 0;
    mockState.llm429FailuresLeft = 0;
    mockState.llmAlways429 = false;

    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.TAVILY_API_KEY = "test-tavily-key";
    process.env.OPENAI_RETRY_MAX = "3";
    process.env.RESEARCH_TIMEOUT_MS_QUICK = "500";
    process.env.LLM_TIMEOUT_MS = "100";
    process.env.TAVILY_CACHE_ENABLED = "false";
    process.env.RESEARCH_ASYNC_ENABLED = "true";

    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("happy path", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/research/web",
      payload: { query: "birthday decor", mode: "quick", market: "US" },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();

    const run = await waitForRun(app, body.runId);
    expect(run.status).toBe("SUCCESS");
    expect(run.timingsMs).toMatchObject({
      tavily: expect.any(Number),
      llm: expect.any(Number),
      scoring: expect.any(Number),
      persist: expect.any(Number),
      total: expect.any(Number),
    });
    expect(run.rows.length).toBeGreaterThan(0);
    expect(run.clusters.length).toBeGreaterThan(0);
  });

  it("end-to-end timeout persists FAILED", async () => {
    process.env.RESEARCH_TIMEOUT_MS_QUICK = "50";
    mockState.llmDelayMs = 120;

    const response = await app.inject({
      method: "POST",
      url: "/v1/research/web",
      payload: { query: "birthday decor", mode: "quick", market: "US" },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();

    await waitForRun(app, body.runId);
    const run = await prisma.webResearchRun.findUniqueOrThrow({ where: { id: body.runId } });
    expect(run.status).toBe("FAILED");
    expect((run.errorJson as any)?.timeout).toBe(true);
  });

  it("LLM timeout fails with stage llm", async () => {
    process.env.RESEARCH_TIMEOUT_MS_QUICK = "500";
    process.env.LLM_TIMEOUT_MS = "20";
    mockState.llmDelayMs = 60;

    const response = await app.inject({
      method: "POST",
      url: "/v1/research/web",
      payload: { query: "birthday decor", mode: "quick", market: "US" },
    });

    expect(response.statusCode).toBe(202);
    const run = await waitForRun(app, response.json().runId);
    expect(run.status).toBe("FAILED");
    expect(run.errorJson.stage).toBe("llm");
  });

  it("429 retry succeeds", async () => {
    process.env.OPENAI_RETRY_MAX = "3";
    mockState.llm429FailuresLeft = 2;

    const response = await app.inject({
      method: "POST",
      url: "/v1/research/web",
      payload: { query: "birthday decor", mode: "quick", market: "US" },
    });

    expect(response.statusCode).toBe(202);
    const run = await waitForRun(app, response.json().runId);
    expect(run.status).toBe("SUCCESS");
    expect(mockState.llmCalls).toBe(3);
  });

  it("429 permanent failure returns FAILED", async () => {
    mockState.llmAlways429 = true;

    const response = await app.inject({
      method: "POST",
      url: "/v1/research/web",
      payload: { query: "birthday decor", mode: "quick", market: "US" },
    });

    expect(response.statusCode).toBe(202);
    const run = await waitForRun(app, response.json().runId);
    expect(run.status).toBe("FAILED");
    expect(run.errorJson.isRateLimit).toBe(true);
  });

  it("tavily cache hit on second run", async () => {
    process.env.TAVILY_CACHE_ENABLED = "true";

    const payload = { query: "birthday decor", mode: "quick", market: "US" };
    const first = await app.inject({ method: "POST", url: "/v1/research/web", payload });
    const second = await app.inject({ method: "POST", url: "/v1/research/web", payload });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);

    await waitForRun(app, first.json().runId);
    await waitForRun(app, second.json().runId);

    expect(mockState.tavilyCalls).toBe(1);

    const secondRun = await prisma.webResearchRun.findUniqueOrThrow({ where: { id: second.json().runId } });
    expect((secondRun.timingsMs as any)?.tavilyCacheHit).toBe(true);
  });

  it("lists runs with pagination", async () => {
    const payload = { query: "birthday decor", mode: "quick", market: "US" };
    const first = await app.inject({ method: "POST", url: "/v1/research/web", payload });
    const second = await app.inject({ method: "POST", url: "/v1/research/web", payload: { ...payload, query: "supplier" } });

    await waitForRun(app, first.json().runId);
    await waitForRun(app, second.json().runId);

    const response = await app.inject({ method: "GET", url: "/v1/research/runs?page=1&pageSize=1" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(1);
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.items.length).toBe(1);
  });
});
