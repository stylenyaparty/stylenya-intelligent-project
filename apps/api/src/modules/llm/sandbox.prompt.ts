export type SandboxSignal = {
    term: string;
    avgMonthlySearches?: number;
    competition?: string;
};

export type SandboxPromptInput = {
    signals: SandboxSignal[];
    seeds?: string[];
    context?: string;
};

export function buildSandboxPrompt(input: SandboxPromptInput) {
    const system = [
        "You are an assistant that returns strict JSON only.",
        "Return JSON matching this structure:",
        JSON.stringify(
            {
                drafts: [
                    {
                        title: "string",
                        rationale: "string",
                        recommendedActions: ["string"],
                        confidence: 0,
                    },
                ],
            },
            null,
            2
        ),
        "Confidence is a number from 0 to 100.",
        "Do not include markdown, code fences, or extra text.",
    ].join("\n");

    const user = JSON.stringify(
        {
            context: input.context ?? null,
            seeds: input.seeds ?? [],
            signals: input.signals,
        },
        null,
        2
    );

    return { system, user };
}
