import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                URL: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                globalThis: 'readonly',
            },
        },
        rules: {
            // Code Quality - relaxed for initial setup
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'no-console': 'off', // Console app
            'prefer-const': 'warn',
            'no-var': 'warn',
            'no-undef': 'warn',
            'no-prototype-builtins': 'warn',
            'no-const-assign': 'error',
            'no-case-declarations': 'warn',

            // ES6+ Features
            'arrow-spacing': 'warn',
            'prefer-arrow-callback': 'warn',
            'prefer-template': 'warn',

            // Best Practices
            eqeqeq: ['warn', 'always'],
            curly: ['warn', 'all'],
            'no-eval': 'error',
            'no-implied-eval': 'error',

            // Style (handled by Prettier mostly)
            indent: ['warn', 4],
            quotes: ['warn', 'single'],
            semi: ['warn', 'always'],
        },
    },
    {
        ignores: ['node_modules/', 'logs/', '.synthdev/', 'coverage/', 'dist/', '*.config.js'],
    },
];
