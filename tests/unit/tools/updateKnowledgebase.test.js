// tests/unit/tools/updateKnowledgebase.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import updateKnowledgebase from '../../../src/tools/update_knowledgebase/implementation.js';
import knowledgebaseManager from '../../../src/tools/common/knowledgebase-manager.js';

describe('UpdateKnowledgebase Tool', () => {
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

    describe('parameter validation', () => {
        it('should return error for missing type parameter', async () => {
            const result = await updateKnowledgebase({ content: 'test' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('type');
        });

        it('should return error for missing content parameter', async () => {
            const result = await updateKnowledgebase({ type: 'append' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('content');
        });

        it('should validate parameter types', async () => {
            const result = await updateKnowledgebase({
                type: 123,
                content: 'test',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Invalid parameter type for type: expected string, got number'
            );
        });

        it('should validate content parameter type', async () => {
            const result = await updateKnowledgebase({
                type: 'append',
                content: 123,
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Invalid parameter type for content: expected string, got number'
            );
        });

        it('should validate operation type values', async () => {
            const result = await updateKnowledgebase({
                type: 'invalid_operation',
                content: 'test',
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid operation type: invalid_operation');
            expect(result.valid_types).toEqual(['override', 'append', 'remove']);
        });
    });

    describe('override operation', () => {
        it('should override empty knowledgebase successfully', async () => {
            const result = await updateKnowledgebase({
                type: 'override',
                content: 'New content',
            });

            expect(result.success).toBe(true);
            expect(result.tool_name).toBe('update_knowledgebase');
            expect(result.operation).toBe('override');
            expect(result.content_provided).toBe('New content');
            expect(result.previous_length).toBe(0);
            expect(result.new_length).toBe(11);
            expect(result.content_changed).toBe(true);
            expect(result.stats).toBeDefined();
        });

        it('should override existing content', async () => {
            // Setup initial content
            knowledgebaseManager.update('override', 'Initial content');

            const result = await updateKnowledgebase({
                type: 'override',
                content: 'Replaced content',
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('override');
            expect(result.previous_length).toBe(15);
            expect(result.new_length).toBe(16); // "Replaced content" = 16 chars
            expect(result.content_changed).toBe(true);
        });

        it('should handle empty string override', async () => {
            knowledgebaseManager.update('override', 'Some content');

            const result = await updateKnowledgebase({
                type: 'override',
                content: '',
            });

            expect(result.success).toBe(true);
            expect(result.new_length).toBe(0);
            expect(result.content_changed).toBe(true);
        });
    });

    describe('append operation', () => {
        it('should append to empty knowledgebase', async () => {
            const result = await updateKnowledgebase({
                type: 'append',
                content: 'First line',
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('append');
            expect(result.previous_length).toBe(0);
            expect(result.new_length).toBe(10);
            expect(result.content_changed).toBe(true);
        });

        it('should append to existing content with newline', async () => {
            knowledgebaseManager.update('override', 'First line');

            const result = await updateKnowledgebase({
                type: 'append',
                content: 'Second line',
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('append');
            expect(result.previous_length).toBe(10);
            expect(result.new_length).toBe(22); // "First line\nSecond line"
            expect(result.content_changed).toBe(true);
        });

        it('should handle multiple appends', async () => {
            await updateKnowledgebase({ type: 'append', content: 'Line 1' });
            await updateKnowledgebase({ type: 'append', content: 'Line 2' });
            const result = await updateKnowledgebase({ type: 'append', content: 'Line 3' });

            expect(result.success).toBe(true);
            expect(result.new_lines).toBe(3);
        });
    });

    describe('remove operation', () => {
        beforeEach(() => {
            knowledgebaseManager.update('override', 'Line 1\nLine 2\nLine 3\nLine 4');
        });

        it('should remove existing content', async () => {
            const result = await updateKnowledgebase({
                type: 'remove',
                content: 'Line 2\n',
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('remove');
            expect(result.content_changed).toBe(true);
        });

        it('should handle removing non-existent content', async () => {
            const result = await updateKnowledgebase({
                type: 'remove',
                content: 'Non-existent line',
            });

            expect(result.success).toBe(true);
            expect(result.content_changed).toBe(false);
        });

        it('should clean up whitespace-only lines', async () => {
            knowledgebaseManager.update('override', 'Line 1\n   \nLine 3\n\t\nLine 5');

            const result = await updateKnowledgebase({
                type: 'remove',
                content: 'Line 3',
            });

            expect(result.success).toBe(true);
            expect(result.content_changed).toBe(true);
        });
    });

    describe('output structure validation', () => {
        it('should have consistent response structure for success', async () => {
            const result = await updateKnowledgebase({
                type: 'append',
                content: 'test content',
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('operation');
            expect(result).toHaveProperty('content_provided');
            expect(result).toHaveProperty('previous_length');
            expect(result).toHaveProperty('new_length');
            expect(result).toHaveProperty('new_lines');
            expect(result).toHaveProperty('content_changed');
            expect(result).toHaveProperty('stats');
        });

        it('should have correct data types', async () => {
            const result = await updateKnowledgebase({
                type: 'append',
                content: 'test content',
            });

            expect(typeof result.success).toBe('boolean');
            expect(typeof result.tool_name).toBe('string');
            expect(typeof result.timestamp).toBe('string');
            expect(typeof result.operation).toBe('string');
            expect(typeof result.content_provided).toBe('string');
            expect(typeof result.previous_length).toBe('number');
            expect(typeof result.new_length).toBe('number');
            expect(typeof result.new_lines).toBe('number');
            expect(typeof result.content_changed).toBe('boolean');
            expect(typeof result.stats).toBe('object');
        });

        it('should have valid timestamp format', async () => {
            const result = await updateKnowledgebase({
                type: 'append',
                content: 'test',
            });

            expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('integration with knowledgebase manager', () => {
        it('should delegate to knowledgebase manager correctly', async () => {
            const spy = vi.spyOn(knowledgebaseManager, 'update');

            await updateKnowledgebase({
                type: 'append',
                content: 'test content',
            });

            expect(spy).toHaveBeenCalledWith('append', 'test content');
            spy.mockRestore();
        });

        it('should handle knowledgebase manager errors', async () => {
            // Mock knowledgebase manager to return error
            const originalUpdate = knowledgebaseManager.update;
            knowledgebaseManager.update = vi.fn().mockReturnValue({
                success: false,
                error: 'Mocked manager error',
            });

            const result = await updateKnowledgebase({
                type: 'append',
                content: 'test',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Mocked manager error');
            expect(result.operation).toBe('append');

            // Restore original method
            knowledgebaseManager.update = originalUpdate;
        });
    });

    describe('error handling', () => {
        it('should handle null parameters gracefully', async () => {
            const result = await updateKnowledgebase(null);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot destructure property');
        });

        it('should handle undefined parameters gracefully', async () => {
            const result = await updateKnowledgebase(undefined);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot destructure property');
        });

        it('should handle unexpected exceptions', async () => {
            // Mock knowledgebase manager to throw error
            const originalUpdate = knowledgebaseManager.update;
            knowledgebaseManager.update = vi.fn().mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = await updateKnowledgebase({
                type: 'append',
                content: 'test',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to update knowledgebase: Unexpected error');
            expect(result.operation).toBe('append');
            expect(result.stack).toBeDefined();

            // Restore original method
            knowledgebaseManager.update = originalUpdate;
        });
    });

    describe('performance', () => {
        it('should execute quickly', async () => {
            const startTime = Date.now();

            await updateKnowledgebase({
                type: 'append',
                content: 'test content',
            });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Should execute very quickly (less than 50ms)
            expect(executionTime).toBeLessThan(50);
        });

        it('should handle large content efficiently', async () => {
            const largeContent = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n');

            const startTime = Date.now();
            const result = await updateKnowledgebase({
                type: 'override',
                content: largeContent,
            });
            const endTime = Date.now();

            expect(result.success).toBe(true);
            expect(endTime - startTime).toBeLessThan(100); // Should still be fast
        });
    });

    describe('edge cases', () => {
        it('should handle content with special characters', async () => {
            const specialContent = 'Content with émojis 🚀 and special chars: @#$%^&*()';

            const result = await updateKnowledgebase({
                type: 'override',
                content: specialContent,
            });

            expect(result.success).toBe(true);
            expect(result.content_provided).toBe(specialContent);
        });

        it('should handle very long content', async () => {
            const longContent = 'A'.repeat(10000);

            const result = await updateKnowledgebase({
                type: 'override',
                content: longContent,
            });

            expect(result.success).toBe(true);
            expect(result.new_length).toBe(10000);
        });

        it('should ignore extra parameters', async () => {
            const result = await updateKnowledgebase({
                type: 'append',
                content: 'test',
                extra_param: 'should_be_ignored',
                another_param: 123,
            });

            expect(result.success).toBe(true);
            expect(result.content_provided).toBe('test');
        });
    });
});
