import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        setupFiles: ["./test/setup.ts"],
        poolOptions: {
            threads: {
                singleThread: true,
            },
        },
        fileParallelism: false,
    },
});