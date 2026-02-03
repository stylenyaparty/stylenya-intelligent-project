export type GenerateTextInput = {
    system?: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json_object" | "text";
};

export interface LLMProvider {
    generateText(input: GenerateTextInput): Promise<{ text: string }>;
}
