// tests/unit/tools/knowledgebase-manager.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgebaseManager } from '../../../src/tools/common/knowledgebase-manager.js';

describe('KnowledgebaseManager', () => {
    let manager;

    beforeEach(() => {
        manager = new KnowledgebaseManager();
        manager.clear(); // Ensure clean state
    });

    describe('initialization', () => {
        it('should initialize with empty knowledgebase', () => {
            const result = manager.read();
            expect(result.success).toBe(true);
            expect(result.content).toBe('');
            expect(result.length).toBe(0);
            expect(result.lines).toBe(0);
        });

        it('should provide correct stats for empty knowledgebase', () => {
            const stats = manager.getStats();
            expect(stats.total_length).toBe(0);
            expect(stats.total_lines).toBe(0);
            expect(stats.non_empty_lines).toBe(0);
            expect(stats.empty_lines).toBe(0);
            expect(stats.is_empty).toBe(true);
        });
    });

    describe('read operation', () => {
        it('should read empty knowledgebase successfully', () => {
            const result = manager.read();
            expect(result.success).toBe(true);
            expect(result.content).toBe('');
            expect(result.length).toBe(0);
            expect(result.lines).toBe(0);
        });

        it('should read non-empty knowledgebase successfully', () => {
            manager.update('override', 'Test content\nSecond line');
            const result = manager.read();
            expect(result.success).toBe(true);
            expect(result.content).toBe('Test content\nSecond line');
            expect(result.length).toBe(24); // "Test content\nSecond line" = 24 chars
            expect(result.lines).toBe(2);
        });
    });

    describe('override operation', () => {
        it('should override empty knowledgebase', () => {
            const result = manager.update('override', 'New content');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('override');
            expect(result.previous_length).toBe(0);
            expect(result.new_length).toBe(11);
            expect(result.content_changed).toBe(true);
        });

        it('should override existing content', () => {
            manager.update('override', 'Initial content');
            const result = manager.update('override', 'Replaced content');
            expect(result.success).toBe(true);
            expect(result.previous_length).toBe(15);
            expect(result.new_length).toBe(16); // "Replaced content" = 16 chars
            expect(result.content_changed).toBe(true);

            const readResult = manager.read();
            expect(readResult.content).toBe('Replaced content');
        });

        it('should handle empty string override', () => {
            manager.update('override', 'Some content');
            const result = manager.update('override', '');
            expect(result.success).toBe(true);
            expect(result.new_length).toBe(0);
            expect(result.content_changed).toBe(true);
        });
    });

    describe('append operation', () => {
        it('should append to empty knowledgebase', () => {
            const result = manager.update('append', 'First line');
            expect(result.success).toBe(true);
            expect(result.operation).toBe('append');
            expect(result.new_length).toBe(10);

            const readResult = manager.read();
            expect(readResult.content).toBe('First line');
        });

        it('should append with newline to existing content', () => {
            manager.update('override', 'First line');
            const result = manager.update('append', 'Second line');
            expect(result.success).toBe(true);

            const readResult = manager.read();
            expect(readResult.content).toBe('First line\nSecond line');
        });

        it('should handle multiple appends', () => {
            manager.update('append', 'Line 1');
            manager.update('append', 'Line 2');
            manager.update('append', 'Line 3');

            const readResult = manager.read();
            expect(readResult.content).toBe('Line 1\nLine 2\nLine 3');
            expect(readResult.lines).toBe(3);
        });

        it('should not add extra newlines if content already ends with newline', () => {
            manager.update('override', 'First line\n');
            manager.update('append', 'Second line');

            const readResult = manager.read();
            expect(readResult.content).toBe('First line\nSecond line');
        });
    });

    describe('remove operation', () => {
        beforeEach(() => {
            manager.update('override', 'Line 1\nLine 2\nLine 3\nLine 4');
        });

        it('should remove existing content', () => {
            const result = manager.update('remove', 'Line 2\n');
            expect(result.success).toBe(true);

            const readResult = manager.read();
            expect(readResult.content).toBe('Line 1\nLine 3\nLine 4');
        });

        it('should clean up whitespace-only lines', () => {
            manager.update('override', 'Line 1\n   \nLine 3\n\t\nLine 5');
            const result = manager.update('remove', 'Line 3');
            expect(result.success).toBe(true);

            const readResult = manager.read();
            expect(readResult.content).toBe('Line 1\nLine 5');
        });

        it('should handle removing non-existent content gracefully', () => {
            const result = manager.update('remove', 'Non-existent line');
            expect(result.success).toBe(true);
            expect(result.content_changed).toBe(false);
        });

        it('should fail when trying to remove empty content', () => {
            const result = manager.update('remove', '');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot remove empty content');
        });

        it('should remove trailing newlines after cleanup', () => {
            manager.update('override', 'Line 1\nLine 2\n\n\n');
            manager.update('remove', 'Line 2');

            const readResult = manager.read();
            expect(readResult.content).toBe('Line 1');
        });
    });

    describe('parameter validation', () => {
        it('should validate operation type', () => {
            const result = manager.update('invalid', 'content');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid operation type');
        });

        it('should require content parameter', () => {
            const result = manager.update('append');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Content parameter is required');
        });

        it('should validate content type', () => {
            const result = manager.update('append', 123);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Content must be a string');
        });

        it('should handle null content', () => {
            const result = manager.update('append', null);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Content parameter is required');
        });
    });

    describe('statistics', () => {
        it('should provide accurate stats for multiline content', () => {
            manager.update('override', 'Line 1\nLine 2\n\nLine 4\n   \nLine 6');
            const stats = manager.getStats();

            expect(stats.total_length).toBe(32);
            expect(stats.total_lines).toBe(6);
            expect(stats.non_empty_lines).toBe(4);
            expect(stats.empty_lines).toBe(2);
            expect(stats.is_empty).toBe(false);
        });

        it('should handle single line content', () => {
            manager.update('override', 'Single line');
            const stats = manager.getStats();

            expect(stats.total_lines).toBe(1);
            expect(stats.non_empty_lines).toBe(1);
            expect(stats.empty_lines).toBe(0);
        });
    });

    describe('clear functionality', () => {
        it('should clear all content', () => {
            manager.update('override', 'Some content');
            manager.clear();

            const result = manager.read();
            expect(result.content).toBe('');
            expect(result.length).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should handle unexpected errors gracefully', () => {
            // Mock a scenario that could cause an error
            const originalKnowledgebase = manager.knowledgebase;
            manager.knowledgebase = null;

            const result = manager.read();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to read knowledgebase');

            // Restore
            manager.knowledgebase = originalKnowledgebase;
        });
    });
});
