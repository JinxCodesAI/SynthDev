// tests/unit/tools/calculate.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import calculate from '../../../tools/calculate/implementation.js';

describe('Calculate Tool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Arithmetic', () => {
        it('should perform simple addition', async () => {
            const result = await calculate({ expression: '2 + 3' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(5);
            expect(result.expression).toBe('2 + 3');
            expect(result.precision).toBe(6);
        });

        it('should perform simple subtraction', async () => {
            const result = await calculate({ expression: '10 - 4' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(6);
        });

        it('should perform simple multiplication', async () => {
            const result = await calculate({ expression: '6 * 7' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(42);
        });

        it('should perform simple division', async () => {
            const result = await calculate({ expression: '15 / 3' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(5);
        });

        it('should handle complex arithmetic with parentheses', async () => {
            const result = await calculate({ expression: '(2 + 3) * (4 - 1)' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(15);
        });

        it('should handle decimal operations', async () => {
            const result = await calculate({ expression: '3.14 * 2' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(6.28);
        });
    });

    describe('Mathematical Functions', () => {
        it('should calculate square root', async () => {
            const result = await calculate({ expression: 'sqrt(16)' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(4);
        });

        it('should calculate power', async () => {
            const result = await calculate({ expression: 'pow(2, 3)' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(8);
        });

        it('should calculate absolute value', async () => {
            const result = await calculate({ expression: 'abs(-5)' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(5);
        });

        it('should calculate logarithm', async () => {
            const result = await calculate({ expression: 'log(e)' });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(1, 5);
        });

        it('should calculate min and max', async () => {
            const minResult = await calculate({ expression: 'min(5, 3, 8, 1)' });
            const maxResult = await calculate({ expression: 'max(5, 3, 8, 1)' });

            expect(minResult.success).toBe(true);
            expect(minResult.result).toBe(1);
            expect(maxResult.success).toBe(true);
            expect(maxResult.result).toBe(8);
        });
    });

    describe('Trigonometric Functions', () => {
        it('should calculate sine', async () => {
            const result = await calculate({ expression: 'sin(pi/2)' });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(1, 5);
        });

        it('should calculate cosine', async () => {
            const result = await calculate({ expression: 'cos(0)' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(1);
        });

        it('should calculate tangent', async () => {
            const result = await calculate({ expression: 'tan(pi/4)' });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(1, 5);
        });

        it('should calculate inverse trigonometric functions', async () => {
            const result = await calculate({ expression: 'asin(1)' });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(Math.PI / 2, 5);
        });
    });

    describe('Mathematical Constants', () => {
        it('should use pi constant', async () => {
            const result = await calculate({ expression: 'pi * 2' });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(2 * Math.PI, 5);
        });

        it('should use e constant', async () => {
            const result = await calculate({ expression: 'e * 2' });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(2 * Math.E, 5);
        });
    });

    describe('Precision Control', () => {
        it('should respect precision parameter', async () => {
            const result = await calculate({
                expression: '1/3',
                precision: 2,
            });

            expect(result.success).toBe(true);
            expect(result.result).toBe(0.33);
            expect(result.precision).toBe(2);
        });

        it('should handle zero precision', async () => {
            const result = await calculate({
                expression: '3.7',
                precision: 0,
            });

            expect(result.success).toBe(true);
            expect(result.result).toBe(4);
        });

        it('should handle high precision', async () => {
            const result = await calculate({
                expression: 'pi',
                precision: 10,
            });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(Math.PI, 10);
            expect(result.precision).toBe(10);
        });
    });

    describe('Error Handling', () => {
        it('should reject missing expression', async () => {
            const result = await calculate({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('expression');
        });

        it('should reject empty expression', async () => {
            const result = await calculate({ expression: '' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Calculation failed');
        });

        it('should reject non-string expression', async () => {
            const result = await calculate({ expression: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('string');
        });

        it('should reject invalid precision range', async () => {
            const result = await calculate({
                expression: '2 + 2',
                precision: 20,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Precision must be a number between 0 and 15');
        });

        it('should reject negative precision', async () => {
            const result = await calculate({
                expression: '2 + 2',
                precision: -1,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Precision must be a number between 0 and 15');
        });

        it('should reject invalid mathematical expression', async () => {
            const result = await calculate({ expression: '2 +' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Calculation failed');
        });

        it('should reject expressions with invalid characters', async () => {
            const result = await calculate({ expression: '2 + $variable' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('invalid characters');
        });

        it('should reject dangerous operations', async () => {
            const result = await calculate({ expression: 'require("fs")' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('invalid characters');
        });

        it('should handle division by zero', async () => {
            const result = await calculate({ expression: '1 / 0' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('infinity');
        });

        it('should handle NaN results', async () => {
            const result = await calculate({ expression: 'sqrt(-1)' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('NaN');
        });
    });

    describe('Complex Expressions', () => {
        it('should handle nested function calls', async () => {
            const result = await calculate({ expression: 'sqrt(pow(3, 2) + pow(4, 2))' });

            expect(result.success).toBe(true);
            expect(result.result).toBe(5);
        });

        it('should handle multiple operations', async () => {
            const result = await calculate({
                expression: 'sin(pi/6) + cos(pi/3) + tan(pi/4)',
            });

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(2, 5);
        });

        it('should handle scientific calculations', async () => {
            const result = await calculate({
                expression: 'log10(1000) + log2(8) + exp(0)',
            });

            expect(result.success).toBe(true);
            expect(result.result).toBe(7); // 3 + 3 + 1
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields', async () => {
            const result = await calculate({ expression: '2 + 2' });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('expression');
            expect(result).toHaveProperty('result');
            expect(result).toHaveProperty('precision');
            expect(result.tool_name).toBe('calculate');
        });

        it('should include error details on failure', async () => {
            const result = await calculate({ expression: 'invalid' });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('error');
            expect(result.success).toBe(false);
        });
    });
});
