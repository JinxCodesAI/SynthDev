import { defineConfig } from 'vitest/config';

// Read the environment variable. Defaults to `true` (showing failures)
// if the variable is unset or not exactly 'false'.
const showFailures = process.env.REPORTER_SHOW_FAILURES !== 'false';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'tests/', '*.config.js', 'logs/', '.index/', 'scripts/'],
            thresholds: {
                global: {
                    branches: 40,
                    functions: 40,
                    lines: 40,
                    statements: 40,
                },
            },
        },
        // Increased timeouts for E2E tests that spawn processes
        testTimeout: process.env.CI ? 60000 : 45000,
        hookTimeout: process.env.CI ? 30000 : 20000,

        // Force sequential execution for better test isolation
        // This prevents race conditions in E2E tests that spawn processes
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
                isolate: true,
            },
        },

        // Ensure tests run sequentially by default to prevent conflicts
        sequence: {
            concurrent: false,
            shuffle: false,
        },

        // Retry flaky tests (especially E2E tests)
        retry: process.env.CI ? 3 : 2,

        // This is the definitive reporter configuration.
        // It passes the `showFailures` option to your custom reporter.
        reporters: [
            //     ['./scripts/reporter.js', { showFailures: true }]
        ],
    },
});
