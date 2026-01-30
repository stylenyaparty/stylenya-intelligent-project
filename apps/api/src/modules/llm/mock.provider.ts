import type { GenerateTextInput, LLMProvider } from "./llm.provider";

const MODIFIERS = [
    "ideas",
    "inspiration",
    "for sale",
    "online",
    "gift",
    "cheap",
    "custom",
    "personalized",
    "wholesale",
    "trends",
    "bulk",
    "2024",
];

function normalizeTopic(value: string) {
    return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function extractTopic(input: GenerateTextInput) {
    const match = input.user.match(/Topic:\s*(.+?)(?:\.|$)/i);
    if (match?.[1]) {
        return normalizeTopic(match[1]);
    }
    return normalizeTopic(input.user);
}

export class MockProvider implements LLMProvider {
    async generateText(input: GenerateTextInput): Promise<{ text: string }> {
        const topic = extractTopic(input);
        const keywords = [] as string[];
        const seen = new Set<string>();

        const baseCandidates = [
            topic,
            `best ${topic}`,
            `${topic} ideas`,
            `${topic} for sale`,
            `${topic} online`,
            `${topic} gift`,
            `${topic} cheap`,
            `${topic} custom`,
            `${topic} personalized`,
            `${topic} wholesale`,
            `${topic} trends`,
            `${topic} bulk`,
        ];

        for (const candidate of baseCandidates) {
            const normalized = candidate.trim();
            if (!normalized) continue;
            const key = normalized.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            keywords.push(normalized);
        }

        for (const modifier of MODIFIERS) {
            const candidate = `${topic} ${modifier}`.trim();
            const key = candidate.toLowerCase();
            if (!candidate || seen.has(key)) continue;
            seen.add(key);
            keywords.push(candidate);
        }

        return { text: keywords.join("\n") };
    }
}
