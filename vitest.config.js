import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'tests/', '*.config.js', 'logs/', '.index/'],
            thresholds: {
                global: {
                    branches: 40,
                    functions: 40,
                    lines: 40,
                    statements: 40,
                },
            },
        },
        testTimeout: 10000,
        // Run tool tests sequentially to avoid file system conflicts
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
    },
});
