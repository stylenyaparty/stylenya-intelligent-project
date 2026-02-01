import type { GenerateTextInput, LLMProvider } from "./llm.provider";

function extractTopic(input: string): string {
    const match = input.match(/Topic:\s*([^\.\n]+)/i);
    if (match?.[1]) return match[1].trim();
    return input.trim().slice(0, 60) || "keywords";
}

function buildSuggestions(topic: string, max: number): string[] {
    const base = topic.trim() || "keywords";
    const variants = [
        base,
        `${base} ideas`,
        `${base} trends`,
        `${base} gifts`,
        `${base} for parties`,
        `${base} for events`,
        `${base} diy`,
        `${base} shop`,
        `${base} bundles`,
        `${base} deals`,
        `${base} inspiration`,
        `${base} decor`,
        `${base} theme`,
        `${base} inspiration ideas`,
        `${base} accessories`,
        `${base} supplies`,
        `${base} premium`,
        `${base} budget`,
        `${base} custom`,
        `${base} personalized`,
    ];

    const seen = new Set<string>();
    const results: string[] = [];
    for (const variant of variants) {
        const key = variant.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(variant);
        if (results.length >= max) break;
    }
    return results;
}

export class MockLLMProvider implements LLMProvider {
    async generateText(input: GenerateTextInput): Promise<{ text: string }> {
        const topic = extractTopic(input.user);
        const max = Math.min(50, Math.max(1, Math.floor((input.maxTokens ?? 256) / 8)));
        const suggestions = buildSuggestions(topic, max);
        return { text: suggestions.join("\n") };
    }
}