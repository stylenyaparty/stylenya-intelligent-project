import type { GenerateTextInput, LLMProvider } from "./llm.provider";

export class OpenAIProvider implements LLMProvider {
    async generateText(input: GenerateTextInput): Promise<{ text: string }> {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("LLM provider error");
            }

            const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
            const messages = [] as Array<{ role: string; content: string }>;
            if (input.system) {
                messages.push({ role: "system", content: input.system });
            }
            messages.push({ role: "user", content: input.user });

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: input.temperature ?? 0.7,
                    max_tokens: input.maxTokens ?? 256,
                    ...(input.responseFormat === "json_object"
                        ? { response_format: { type: "json_object" } }
                        : {}),
                }),
            });

            if (!response.ok) {
                throw new Error("LLM provider error");
            }

            const data = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };
            const text = data.choices?.[0]?.message?.content?.trim();
            if (!text) {
                throw new Error("LLM provider error");
            }

            return { text };
        } catch {
            throw new Error("LLM provider error");
        }
    }
}
