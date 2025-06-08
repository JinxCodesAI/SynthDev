// tests/unit/core/costsManager.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import costsManager from '../../../costsManager.js';

describe('CostsManager', () => {
    beforeEach(() => {
        // Reset the costs manager state before each test
        costsManager.modelCosts = {};
    });

    describe('addUsage', () => {
        it('should add usage for a new model', () => {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4']).toEqual({
                cached_tokens: 0,
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
                reasoning_tokens: 0,
            });
        });

        it('should accumulate usage for existing model', () => {
            const usage1 = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            };
            const usage2 = {
                prompt_tokens: 200,
                completion_tokens: 75,
                total_tokens: 275,
            };

            costsManager.addUsage('gpt-4', usage1);
            costsManager.addUsage('gpt-4', usage2);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4']).toEqual({
                cached_tokens: 0,
                prompt_tokens: 300,
                completion_tokens: 125,
                total_tokens: 425,
                reasoning_tokens: 0,
            });
        });

        it('should handle cached tokens from prompt_tokens_details', () => {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
                prompt_tokens_details: {
                    cached_tokens: 25,
                },
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4'].cached_tokens).toBe(25);
        });

        it('should handle reasoning tokens from completion_tokens_details', () => {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
                completion_tokens_details: {
                    reasoning_tokens: 15,
                },
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4'].reasoning_tokens).toBe(15);
        });

        it('should handle usage with both cached and reasoning tokens', () => {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
                prompt_tokens_details: {
                    cached_tokens: 25,
                },
                completion_tokens_details: {
                    reasoning_tokens: 15,
                },
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4']).toEqual({
                cached_tokens: 25,
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
                reasoning_tokens: 15,
            });
        });

        it('should handle null or undefined usage gracefully', () => {
            costsManager.addUsage('gpt-4', null);
            costsManager.addUsage('gpt-4', undefined);

            const costs = costsManager.getTotalCosts();
            expect(costs).toEqual({});
        });

        it('should handle missing token fields gracefully', () => {
            const usage = {
                // Missing some fields
                prompt_tokens: 100,
                // completion_tokens missing
                // total_tokens missing
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4']).toEqual({
                cached_tokens: 0,
                prompt_tokens: 100,
                completion_tokens: 0,
                total_tokens: 0,
                reasoning_tokens: 0,
            });
        });

        it('should handle multiple models', () => {
            const usage1 = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            };
            const usage2 = {
                prompt_tokens: 200,
                completion_tokens: 75,
                total_tokens: 275,
            };

            costsManager.addUsage('gpt-4', usage1);
            costsManager.addUsage('gpt-3.5-turbo', usage2);

            const costs = costsManager.getTotalCosts();
            expect(Object.keys(costs)).toHaveLength(2);
            expect(costs['gpt-4'].prompt_tokens).toBe(100);
            expect(costs['gpt-3.5-turbo'].prompt_tokens).toBe(200);
        });
    });

    describe('getTotalCosts', () => {
        it('should return empty object when no usage added', () => {
            const costs = costsManager.getTotalCosts();
            expect(costs).toEqual({});
        });

        it('should return all model costs', () => {
            const usage1 = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            };
            const usage2 = {
                prompt_tokens: 200,
                completion_tokens: 75,
                total_tokens: 275,
            };

            costsManager.addUsage('gpt-4', usage1);
            costsManager.addUsage('gpt-3.5-turbo', usage2);

            const costs = costsManager.getTotalCosts();
            expect(costs).toHaveProperty('gpt-4');
            expect(costs).toHaveProperty('gpt-3.5-turbo');
            expect(Object.keys(costs)).toHaveLength(2);
        });

        it('should return the same reference to costs object', () => {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            };

            costsManager.addUsage('gpt-4', usage);

            const costs1 = costsManager.getTotalCosts();
            const costs2 = costsManager.getTotalCosts();

            // Should be the same object reference (current implementation)
            expect(costs1).toBe(costs2);
            // And with same content
            expect(costs1).toEqual(costs2);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle zero values', () => {
            const usage = {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4']).toEqual({
                cached_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                reasoning_tokens: 0,
            });
        });

        it('should handle negative values (edge case)', () => {
            const usage = {
                prompt_tokens: -10,
                completion_tokens: -5,
                total_tokens: -15,
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4']).toEqual({
                cached_tokens: 0,
                prompt_tokens: -10,
                completion_tokens: -5,
                total_tokens: -15,
                reasoning_tokens: 0,
            });
        });

        it('should handle very large numbers', () => {
            const usage = {
                prompt_tokens: 1000000,
                completion_tokens: 500000,
                total_tokens: 1500000,
            };

            costsManager.addUsage('gpt-4', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4'].prompt_tokens).toBe(1000000);
            expect(costs['gpt-4'].completion_tokens).toBe(500000);
            expect(costs['gpt-4'].total_tokens).toBe(1500000);
        });

        it('should handle empty model name', () => {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            };

            costsManager.addUsage('', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['']).toBeDefined();
            expect(costs[''].prompt_tokens).toBe(100);
        });

        it('should handle special characters in model name', () => {
            const usage = {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            };

            costsManager.addUsage('gpt-4-turbo-preview', usage);
            costsManager.addUsage('claude-3.5-sonnet', usage);

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4-turbo-preview']).toBeDefined();
            expect(costs['claude-3.5-sonnet']).toBeDefined();
        });
    });

    describe('integration scenarios', () => {
        it('should handle realistic usage patterns', () => {
            // Simulate a conversation with multiple API calls
            const calls = [
                {
                    model: 'gpt-4',
                    usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
                },
                {
                    model: 'gpt-4',
                    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
                },
                {
                    model: 'gpt-4',
                    usage: { prompt_tokens: 75, completion_tokens: 30, total_tokens: 105 },
                },
            ];

            calls.forEach(call => {
                costsManager.addUsage(call.model, call.usage);
            });

            const costs = costsManager.getTotalCosts();
            expect(costs['gpt-4']).toEqual({
                cached_tokens: 0,
                prompt_tokens: 225, // 50 + 100 + 75
                completion_tokens: 105, // 25 + 50 + 30
                total_tokens: 330, // 75 + 150 + 105
                reasoning_tokens: 0,
            });
        });

        it('should handle mixed model usage', () => {
            const gpt4Usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
            const gpt35Usage = { prompt_tokens: 200, completion_tokens: 75, total_tokens: 275 };
            const claudeUsage = { prompt_tokens: 150, completion_tokens: 60, total_tokens: 210 };

            costsManager.addUsage('gpt-4', gpt4Usage);
            costsManager.addUsage('gpt-3.5-turbo', gpt35Usage);
            costsManager.addUsage('claude-3-sonnet', claudeUsage);

            const costs = costsManager.getTotalCosts();
            expect(Object.keys(costs)).toHaveLength(3);
            expect(costs['gpt-4'].total_tokens).toBe(150);
            expect(costs['gpt-3.5-turbo'].total_tokens).toBe(275);
            expect(costs['claude-3-sonnet'].total_tokens).toBe(210);
        });
    });
});
