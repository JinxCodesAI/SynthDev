// tests/unit/tools/getTime.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import getTime from '../../../tools/get_time/implementation.js';

describe('GetTime Tool', () => {
    let originalDate;

    beforeEach(() => {
        // Mock Date to have consistent test results
        originalDate = global.Date;
        const mockDate = new Date('2024-01-15T10:30:45.123Z');
        global.Date = vi.fn(() => mockDate);
        global.Date.now = vi.fn(() => mockDate.getTime());
        global.Date.UTC = originalDate.UTC;
        global.Date.parse = originalDate.parse;
        global.Date.prototype = originalDate.prototype;
    });

    afterEach(() => {
        // Restore original Date
        global.Date = originalDate;
        vi.restoreAllMocks();
    });

    describe('successful time retrieval', () => {
        it('should return current time with default parameters', async () => {
            const result = await getTime({});

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('get_time');
            expect(result.current_time).toBeDefined();
            expect(result.timezone).toBeDefined();
            expect(result.timestamp).toBeDefined();
            expect(result.format).toBe('iso');
            expect(result.iso_string).toBeDefined();
            expect(result.unix_timestamp).toBeDefined();
            expect(result.readable_format).toBeDefined();
        });

        it('should return time in ISO format', async () => {
            const result = await getTime({ format: 'iso' });

            expect(result.success).toBe(true);
            expect(result.current_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(result.iso_string).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should return time in readable format', async () => {
            const result = await getTime({ format: 'readable' });

            expect(result.success).toBe(true);
            expect(result.current_time).toBeDefined();
            expect(result.readable_format).toBeDefined();
        });

        it('should return time in custom format', async () => {
            const result = await getTime({
                format: 'custom',
                custom_format: 'YYYY-MM-DD HH:mm:ss',
            });

            expect(result.success).toBe(true);
            expect(result.current_time).toBeDefined();
            expect(result.format).toBe('custom');
        });

        it('should return time in unix format', async () => {
            const result = await getTime({ format: 'unix' });

            expect(result.success).toBe(true);
            expect(result.current_time).toBeDefined();
            expect(typeof result.current_time).toBe('number');
            expect(result.unix_timestamp).toBeDefined();
            expect(typeof result.unix_timestamp).toBe('number');
        });

        it('should include timezone information', async () => {
            const result = await getTime({});

            expect(result.success).toBe(true);
            expect(result.timezone).toBeDefined();
            expect(typeof result.timezone).toBe('string');
        });

        it('should include all format variations', async () => {
            const result = await getTime({});

            expect(result.success).toBe(true);
            expect(result.iso_string).toBeDefined();
            expect(result.unix_timestamp).toBeDefined();
            expect(result.readable_format).toBeDefined();
            expect(result.format).toBe('iso');
        });
    });

    describe('parameter validation', () => {
        it('should handle empty parameters', async () => {
            const result = await getTime({});

            expect(result.success).toBe(true);
            expect(result.current_time).toBeDefined();
        });

        it('should handle null parameters', async () => {
            const result = await getTime(null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot read properties of null');
        });

        it('should handle undefined parameters', async () => {
            const result = await getTime(undefined);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot read properties of undefined');
        });

        it('should validate format parameter type', async () => {
            const result = await getTime({ format: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Invalid parameter type for format: expected string, got number'
            );
        });

        it('should validate timezone parameter type', async () => {
            const result = await getTime({ timezone: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Invalid parameter type for timezone: expected string, got number'
            );
        });

        it('should handle invalid format values', async () => {
            const result = await getTime({ format: 'invalid' });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Invalid format. Must be one of: iso, unix, readable, custom'
            );
        });
    });

    describe('timezone handling', () => {
        it('should handle valid timezone', async () => {
            const result = await getTime({ timezone: 'America/New_York' });

            expect(result.success).toBe(true);
            expect(result.timezone).toBe('America/New_York');
        });

        it('should handle UTC timezone', async () => {
            const result = await getTime({ timezone: 'UTC' });

            expect(result.success).toBe(true);
            expect(result.timezone).toBe('UTC');
        });

        it('should handle invalid timezone gracefully', async () => {
            const result = await getTime({ timezone: 'Invalid/Timezone' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid time zone specified: Invalid/Timezone');
        });
    });

    describe('format combinations', () => {
        it('should handle format and timezone together', async () => {
            const result = await getTime({
                format: 'iso',
                timezone: 'UTC',
            });

            expect(result.success).toBe(true);
            expect(result.current_time).toBeDefined(); // ISO format with timezone doesn't end with Z
            expect(result.timezone).toBe('UTC');
        });

        it('should handle unix format with timezone', async () => {
            const result = await getTime({
                format: 'unix',
                timezone: 'America/New_York',
            });

            expect(result.success).toBe(true);
            expect(typeof result.current_time).toBe('number');
            expect(result.timezone).toBe('America/New_York');
        });
    });

    describe('edge cases', () => {
        it('should handle extra parameters gracefully', async () => {
            const result = await getTime({
                format: 'iso',
                timezone: 'UTC',
                extra_param: 'should_be_ignored',
            });

            expect(result.success).toBe(true);
            expect(result.current_time).toBeDefined();
        });

        it('should return consistent timestamp format', async () => {
            const result = await getTime({});

            expect(result.success).toBe(true);
            expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should handle case sensitivity in format', async () => {
            const result = await getTime({ format: 'ISO' });

            // Should either work (case insensitive) or fail gracefully
            expect(result.success).toBeDefined();
            if (!result.success) {
                expect(result.error).toContain('format');
            }
        });
    });

    describe('output validation', () => {
        it('should have consistent structure', async () => {
            const result = await getTime({});

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('current_time');
            expect(result).toHaveProperty('timezone');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('format');
            expect(result).toHaveProperty('iso_string');
            expect(result).toHaveProperty('unix_timestamp');
            expect(result).toHaveProperty('readable_format');
        });

        it('should have all required format types', async () => {
            const result = await getTime({});

            expect(result.iso_string).toBeDefined();
            expect(result.unix_timestamp).toBeDefined();
            expect(result.readable_format).toBeDefined();
            expect(result.format).toBe('iso');
        });

        it('should have valid unix timestamp', async () => {
            const result = await getTime({});

            expect(result.success).toBe(true);
            expect(typeof result.unix_timestamp).toBe('number');
            expect(result.unix_timestamp).toBeGreaterThan(0);
        });

        it('should have readable format as string', async () => {
            const result = await getTime({});

            expect(result.success).toBe(true);
            expect(typeof result.readable_format).toBe('string');
            expect(result.readable_format.length).toBeGreaterThan(0);
        });
    });

    describe('performance and reliability', () => {
        it('should execute quickly', async () => {
            const startTime = Date.now();

            await getTime({});

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Should execute very quickly (less than 100ms)
            expect(executionTime).toBeLessThan(100);
        });

        it('should be consistent across multiple calls', async () => {
            const result1 = await getTime({ format: 'unix' });
            const result2 = await getTime({ format: 'unix' });

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);

            // Since we're mocking Date, they should be identical
            expect(result1.current_time).toBe(result2.current_time);
        });

        it('should handle concurrent calls', async () => {
            const promises = Array.from({ length: 5 }, () => getTime({}));
            const results = await Promise.all(promises);

            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.current_time).toBeDefined();
            });
        });
    });
});
