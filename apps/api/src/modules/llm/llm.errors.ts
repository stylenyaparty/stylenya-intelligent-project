export class LLMNotConfiguredError extends Error {
    constructor(message = "LLM provider is not configured.") {
        super(message);
        this.name = "LLMNotConfiguredError";
    }
}
