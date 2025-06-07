// tests/unit/tools/readKnowledgebase.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import readKnowledgebase from '../../../src/tools/read_knowledgebase/implementation.js';
import knowledgebaseManager from '../../../src/tools/common/knowledgebase-manager.js';

describe('ReadKnowledgebase Tool', () => {
    // Mock logger
    vi.mock('../../../src/core/managers/logger.js', () => ({
        getLogger: vi.fn().mockReturnValue({
            raw: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        }),
    }));

    beforeEach(() => {
        // Clear knowledgebase before each test
        knowledgebaseManager.clear();
        vi.clearAllMocks();
    });

    describe('successful execution', () => {
        it('should read empty knowledgebase successfully', async () => {
            const result = await readKnowledgebase({});

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('read_knowledgebase');
            expect(result.content).toBe('');
            expect(result.length).toBe(0);
            expect(result.lines).toBe(0);
            expect(result.is_empty).toBe(true);
            expect(result.timestamp).toBeDefined();
            expect(result.stats).toBeDefined();
        });

        it('should read non-empty knowledgebase successfully', async () => {
            // Setup knowledgebase with content
            knowledgebaseManager.update('override', 'Test content\nSecond line');

            const result = await readKnowledgebase({});

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('read_knowledgebase');
            expect(result.content).toBe('Test content\nSecond line');
            expect(result.length).toBe(24); // "Test content\nSecond line" = 24 chars
            expect(result.lines).toBe(2);
            expect(result.is_empty).toBe(false);
            expect(result.stats).toBeDefined();
            expect(result.stats.total_lines).toBe(2);
            expect(result.stats.non_empty_lines).toBe(2);
        });

        it('should include comprehensive stats', async () => {
            knowledgebaseManager.update('override', 'Line 1\nLine 2\n\nLine 4');

            const result = await readKnowledgebase({});

            expect(result.success).toBe(true);
            expect(result.stats).toEqual({
                total_length: 21, // "Line 1\nLine 2\n\nLine 4" = 21 chars
                total_lines: 4,
                non_empty_lines: 3,
                empty_lines: 1,
                is_empty: false,
            });
        });
    });

    describe('parameter handling', () => {
        it('should handle empty parameters object', async () => {
            const result = await readKnowledgebase({});

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
        });

        it('should ignore extra parameters', async () => {
            const result = await readKnowledgebase({
                extra_param: 'should_be_ignored',
                another_param: 123,
            });

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
        });

        it('should handle null parameters gracefully', async () => {
            const result = await readKnowledgebase(null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot destructure property');
        });

        it('should handle undefined parameters gracefully', async () => {
            const result = await readKnowledgebase(undefined);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot destructure property');
        });
    });

    describe('output structure validation', () => {
        it('should have consistent response structure', async () => {
            const result = await readKnowledgebase({});

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('length');
            expect(result).toHaveProperty('lines');
            expect(result).toHaveProperty('is_empty');
            expect(result).toHaveProperty('stats');
        });

        it('should have correct data types', async () => {
            const result = await readKnowledgebase({});

            expect(typeof result.success).toBe('boolean');
            expect(typeof result.tool_name).toBe('string');
            expect(typeof result.timestamp).toBe('string');
            expect(typeof result.content).toBe('string');
            expect(typeof result.length).toBe('number');
            expect(typeof result.lines).toBe('number');
            expect(typeof result.is_empty).toBe('boolean');
            expect(typeof result.stats).toBe('object');
        });

        it('should have valid timestamp format', async () => {
            const result = await readKnowledgebase({});

            expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('integration with knowledgebase manager', () => {
        it('should reflect changes made to knowledgebase', async () => {
            // Initial read
            let result = await readKnowledgebase({});
            expect(result.content).toBe('');

            // Add content
            knowledgebaseManager.update('override', 'New content');
            result = await readKnowledgebase({});
            expect(result.content).toBe('New content');

            // Append content
            knowledgebaseManager.update('append', 'Appended line');
            result = await readKnowledgebase({});
            expect(result.content).toBe('New content\nAppended line');

            // Remove content
            knowledgebaseManager.update('remove', 'New content\n');
            result = await readKnowledgebase({});
            expect(result.content).toBe('Appended line');
        });

        it('should handle concurrent reads', async () => {
            knowledgebaseManager.update('override', 'Shared content');

            const promises = Array.from({ length: 5 }, () => readKnowledgebase({}));
            const results = await Promise.all(promises);

            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.content).toBe('Shared content');
            });
        });
    });

    describe('error handling', () => {
        it('should handle knowledgebase manager errors', async () => {
            // Mock knowledgebase manager to return error
            const originalRead = knowledgebaseManager.read;
            knowledgebaseManager.read = vi.fn().mockReturnValue({
                success: false,
                error: 'Mocked error',
            });

            const result = await readKnowledgebase({});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Mocked error');
            expect(result.operation).toBe('read');

            // Restore original method
            knowledgebaseManager.read = originalRead;
        });

        it('should handle unexpected exceptions', async () => {
            // Mock knowledgebase manager to throw error
            const originalRead = knowledgebaseManager.read;
            knowledgebaseManager.read = vi.fn().mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = await readKnowledgebase({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to read knowledgebase: Unexpected error');
            expect(result.operation).toBe('read');
            expect(result.stack).toBeDefined();

            // Restore original method
            knowledgebaseManager.read = originalRead;
        });
    });

    describe('performance', () => {
        it('should execute quickly', async () => {
            const startTime = Date.now();

            await readKnowledgebase({});

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Should execute very quickly (less than 50ms)
            expect(executionTime).toBeLessThan(50);
        });

        it('should handle large content efficiently', async () => {
            // Create large content
            const largeContent = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n');
            knowledgebaseManager.update('override', largeContent);

            const startTime = Date.now();
            const result = await readKnowledgebase({});
            const endTime = Date.now();

            expect(result.success).toBe(true);
            expect(result.lines).toBe(1000);
            expect(endTime - startTime).toBeLessThan(100); // Should still be fast
        });
    });

    describe('edge cases', () => {
        it('should handle content with special characters', async () => {
            const specialContent = 'Content with émojis 🚀 and special chars: @#$%^&*()';
            knowledgebaseManager.update('override', specialContent);

            const result = await readKnowledgebase({});

            expect(result.success).toBe(true);
            expect(result.content).toBe(specialContent);
        });

        it('should handle very long lines', async () => {
            const longLine = 'A'.repeat(10000);
            knowledgebaseManager.update('override', longLine);

            const result = await readKnowledgebase({});

            expect(result.success).toBe(true);
            expect(result.content).toBe(longLine);
            expect(result.length).toBe(10000);
            expect(result.lines).toBe(1);
        });

        it('should handle content with only whitespace', async () => {
            knowledgebaseManager.update('override', '   \n\t\n   ');

            const result = await readKnowledgebase({});

            expect(result.success).toBe(true);
            expect(result.content).toBe('   \n\t\n   ');
            expect(result.lines).toBe(3);
        });
    });
});
