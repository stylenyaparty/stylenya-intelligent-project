type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

export class MemoryCache {
    private readonly store = new Map<string, CacheEntry<unknown>>();

    clear() {
        this.store.clear();
    }

    get<T>(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) return null;

        if (Date.now() >= entry.expiresAt) {
            this.store.delete(key);
            return null;
        }

        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlMs: number) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + Math.max(1, ttlMs),
        });
    }
}

export const memoryCache = new MemoryCache();
