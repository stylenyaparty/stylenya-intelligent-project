const LEGACY_MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isLegacyApiEnabled() {
    return process.env.LEGACY_API_ENABLED === "true";
}

export function isLegacyEngineEnabled() {
    return process.env.LEGACY_ENGINE_ENABLED === "true";
}

export function isLegacyMutation(method: string) {
    return LEGACY_MUTATING_METHODS.has(method.toUpperCase());
}
