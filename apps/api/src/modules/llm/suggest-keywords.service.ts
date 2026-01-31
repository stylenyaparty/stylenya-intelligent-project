import { getLLMProvider } from "./get-llm-provider";

function parseKeywords(text: string, max: number) {
    let parts = text.split("\n").map((entry) => entry.trim()).filter(Boolean);
    if (parts.length === 1 && parts[0].includes(",")) {
        parts = parts[0].split(",").map((entry) => entry.trim()).filter(Boolean);
    }

    const seen = new Set<string>();
    const keywords: string[] = [];

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        keywords.push(trimmed);
        if (keywords.length >= max) break;
    }

    return keywords;
}

export async function suggestKeywords(topic: string, max: number): Promise<string[]> {
    const provider = getLLMProvider();
    const limitedMax = Math.min(max, 50);
    const system =
        "You generate SEO keyword suggestions for e-commerce. Return one keyword per line. No numbering.";
    const user = `Topic: ${topic}. Return ${limitedMax} keyword suggestions.`;

    const { text } = await provider.generateText({
        system,
        user,
        temperature: 0.3,
        maxTokens: 300,
    });

    return parseKeywords(text, limitedMax);
}
