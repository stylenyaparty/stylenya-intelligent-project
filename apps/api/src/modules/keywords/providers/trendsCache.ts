type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

export class TrendsCache<T> {
    private readonly ttlMs: number;
    private readonly store = new Map<string, CacheEntry<T>>();

    constructor(ttlMs = 24 * 60 * 60 * 1000) {
        this.ttlMs = ttlMs;
    }

    get(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) {
            return null;
        }
        if (Date.now() >= entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key: string, value: T) {
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }
}
