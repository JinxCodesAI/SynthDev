// tests/unit/config/providers.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Providers Configuration', () => {
    let providersConfig;

    beforeAll(() => {
        const providersPath = join(__dirname, '../../../src/config/defaults/providers.json');
        const providersData = readFileSync(providersPath, 'utf8');
        providersConfig = JSON.parse(providersData);
    });

    it('should have valid JSON structure', () => {
        expect(providersConfig).toBeDefined();
        expect(providersConfig.providers).toBeInstanceOf(Array);
        expect(providersConfig.providers.length).toBeGreaterThan(0);
    });

    it('should have isReasoning property for all models', () => {
        for (const provider of providersConfig.providers) {
            expect(provider.models).toBeInstanceOf(Array);
            for (const model of provider.models) {
                expect(model).toHaveProperty('isReasoning');
                expect(typeof model.isReasoning).toBe('boolean');
            }
        }
    });

    it('should have XAI models with isReasoning: true', () => {
        const xaiProvider = providersConfig.providers.find(p => p.name === 'XAI');
        expect(xaiProvider).toBeDefined();

        for (const model of xaiProvider.models) {
            expect(model.isReasoning).toBe(true);
        }
    });

    it('should have Google models with isReasoning: true', () => {
        const googleProvider = providersConfig.providers.find(p => p.name === 'Google');
        expect(googleProvider).toBeDefined();

        for (const model of googleProvider.models) {
            expect(model.isReasoning).toBe(true);
        }
    });

    it('should have OpenAI models with correct isReasoning values', () => {
        const openaiProvider = providersConfig.providers.find(p => p.name === 'OpenAI');
        expect(openaiProvider).toBeDefined();

        // o4-mini should have isReasoning: true
        const o4Mini = openaiProvider.models.find(m => m.name === 'o4-mini');
        expect(o4Mini).toBeDefined();
        expect(o4Mini.isReasoning).toBe(true);

        // Other OpenAI models should have isReasoning: false
        const otherModels = openaiProvider.models.filter(m => m.name !== 'o4-mini');
        for (const model of otherModels) {
            expect(model.isReasoning).toBe(false);
        }
    });

    it('should have Anthropic models with isReasoning: false', () => {
        const anthropicProvider = providersConfig.providers.find(p => p.name === 'Anthropic');
        expect(anthropicProvider).toBeDefined();

        for (const model of anthropicProvider.models) {
            expect(model.isReasoning).toBe(false);
        }
    });

    it('should have OpenRouter Google models with isReasoning: true', () => {
        const openRouterProvider = providersConfig.providers.find(p => p.name === 'OpenRouter');
        expect(openRouterProvider).toBeDefined();

        const googleModels = openRouterProvider.models.filter(m => m.name.startsWith('google/'));
        expect(googleModels.length).toBeGreaterThan(0);

        for (const model of googleModels) {
            expect(model.isReasoning).toBe(true);
        }
    });

    it('should have OpenRouter non-Google models with isReasoning: false', () => {
        const openRouterProvider = providersConfig.providers.find(p => p.name === 'OpenRouter');
        expect(openRouterProvider).toBeDefined();

        const nonGoogleModels = openRouterProvider.models.filter(
            m => !m.name.startsWith('google/')
        );

        for (const model of nonGoogleModels) {
            expect(model.isReasoning).toBe(false);
        }
    });
});
