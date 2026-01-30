export type GenerateTextInput = {
    system?: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
};

export interface LLMProvider {
    generateText(input: GenerateTextInput): Promise<{ text: string }>;
}
