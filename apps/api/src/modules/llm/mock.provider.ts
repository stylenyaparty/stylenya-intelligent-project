import type { GenerateTextInput, LLMProvider } from "./llm.provider";

function clampConfidence(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

export class MockLLMProvider implements LLMProvider {
    async generateText(input: GenerateTextInput): Promise<{ text: string }> {
        if (input.responseFormat === "json_object") {
            const payload = {
                drafts: [
                    {
                        title: "Launch a seasonal keyword bundle",
                        rationale:
                            "Promoted keyword signals show rising intent for the current season. Bundling products can capture demand.",
                        recommendedActions: [
                            "Create a seasonal landing page for top promoted keywords.",
                            "Bundle top 3 matching products into a featured collection.",
                        ],
                        confidence: clampConfidence(78),
                    },
                ],
            };
            return { text: JSON.stringify(payload) };
        }

        return { text: "{}" };
    }
}
