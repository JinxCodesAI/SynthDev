// tests/unit/tools/knowledgebase-manager.test.js
import { describe, it, expect, beforeEach } from 'vitest';
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

        it('should remove content and add newline if needed to separate words', () => {
            manager.update('override', 'HelloWorldGoodbye');
            const result = manager.update('remove', 'World');
            expect(result.success).toBe(true);

            const readResult = manager.read();
            // Should add newline between "Hello" and "Goodbye" since neither ends with whitespace
            expect(readResult.content).toBe('Hello\nGoodbye');
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

        it('should not add newline when whitespace is present on either side', () => {
            manager.update('override', 'Hello World Goodbye');
            manager.update('remove', 'World');

            const readResult = manager.read();
            // Should not add newline because there are spaces on both sides
            expect(readResult.content).toBe('Hello  Goodbye');
        });

        it('should handle multiline content removal', () => {
            manager.update('override', 'Start\nLine 1\nLine 2\nEnd');
            const result = manager.update('remove', 'Line 1\nLine 2');
            expect(result.success).toBe(true);

            const readResult = manager.read();
            // Should add newline between "Start" and "End" since neither ends with whitespace
            expect(readResult.content).toBe('Start\n\nEnd');
        });

        it('should handle removal at the beginning of content', () => {
            manager.update('override', 'RemoveThisRest of content');
            manager.update('remove', 'RemoveThis');

            const readResult = manager.read();
            expect(readResult.content).toBe('Rest of content');
        });

        it('should handle removal at the end of content', () => {
            manager.update('override', 'Start of contentRemoveThis');
            manager.update('remove', 'RemoveThis');

            const readResult = manager.read();
            expect(readResult.content).toBe('Start of content');
        });

        it('should handle multiple occurrences of the same content', () => {
            manager.update('override', 'TestWordTestWordTest');
            manager.update('remove', 'Word');

            const readResult = manager.read();
            // Should add newlines where needed
            expect(readResult.content).toBe('Test\nTest\nTest');
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
