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
        testTimeout: 10000,
        // Run tool tests sequentially to avoid file system conflicts
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },

        // This is the definitive reporter configuration.
        // It passes the `showFailures` option to your custom reporter.
        reporters: [
            //     ['./scripts/reporter.js', { showFailures: true }]
        ],
    },
});
