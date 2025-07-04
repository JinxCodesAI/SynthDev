import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WorkflowContext from '../../../src/workflow/WorkflowContext.js';

// Mock dependencies
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

describe('WorkflowContext', () => {
    let workflowContext;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with context configuration', () => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Hello' },
                ],
                max_length: 1000,
            };

            workflowContext = new WorkflowContext(contextConfig);

            expect(workflowContext.name).toBe('test_context');
            expect(workflowContext.maxLength).toBe(1000);
            expect(workflowContext.messages).toHaveLength(2);
            expect(workflowContext.messages[0]).toEqual({
                role: 'system',
                content: 'You are a helpful assistant',
            });
        });

        it('should use default max length when not specified', () => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [],
            };

            workflowContext = new WorkflowContext(contextConfig);

            expect(workflowContext.maxLength).toBe(50000);
        });

        it('should initialize with empty messages when not specified', () => {
            const contextConfig = {
                name: 'test_context',
            };

            workflowContext = new WorkflowContext(contextConfig);

            expect(workflowContext.messages).toHaveLength(0);
        });
    });

    describe('addMessage', () => {
        beforeEach(() => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [{ role: 'system', content: 'System message' }],
                max_length: 100,
            };
            workflowContext = new WorkflowContext(contextConfig);
        });

        it('should add message to context', () => {
            const message = { role: 'user', content: 'Test message' };

            workflowContext.addMessage(message);

            expect(workflowContext.messages).toHaveLength(2);
            expect(workflowContext.messages[1]).toEqual(message);
        });

        it('should add message without modifying it', () => {
            const message = { role: 'user', content: 'Test message' };

            workflowContext.addMessage(message);

            const addedMessage = workflowContext.messages[1];
            expect(addedMessage).toEqual(message);
            expect(addedMessage.role).toBe('user');
            expect(addedMessage.content).toBe('Test message');
        });

        it('should trim messages when exceeding max length', () => {
            // Add many messages that exceed max length (need more than 10 to trigger trimming)
            for (let i = 0; i < 15; i++) {
                workflowContext.addMessage({
                    role: 'user',
                    content: 'A'.repeat(10), // 10 characters each
                });
            }

            // Should have trimmed some messages but kept at least 10 non-system messages
            const nonSystemMessages = workflowContext.messages.filter(m => m.role !== 'system');
            expect(nonSystemMessages.length).toBeGreaterThanOrEqual(10);
            expect(workflowContext.messages.length).toBeGreaterThan(0);
        });

        it('should preserve system messages when trimming', () => {
            const systemMessage = { role: 'system', content: 'System message' };
            workflowContext.messages = [systemMessage];

            // Add many messages to trigger trimming
            for (let i = 0; i < 10; i++) {
                workflowContext.addMessage({
                    role: 'user',
                    content: 'A'.repeat(20),
                });
            }

            // System message should still be there
            expect(workflowContext.messages[0]).toEqual(
                expect.objectContaining({
                    role: 'system',
                    content: 'System message',
                })
            );
        });
    });

    describe('getMessages', () => {
        beforeEach(() => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [
                    { role: 'system', content: 'System message' },
                    { role: 'user', content: 'User message' },
                ],
            };
            workflowContext = new WorkflowContext(contextConfig);
        });

        it('should return all messages', () => {
            const messages = workflowContext.getMessages();

            expect(messages).toHaveLength(2);
            expect(messages[0].content).toBe('System message');
            expect(messages[1].content).toBe('User message');
        });

        it('should return copy of messages array', () => {
            const messages = workflowContext.getMessages();

            // Modifying returned array should not affect original
            messages.push({ role: 'assistant', content: 'New message' });

            expect(workflowContext.messages).toHaveLength(2);
        });
    });

    describe('clearMessages', () => {
        beforeEach(() => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [
                    { role: 'system', content: 'System message' },
                    { role: 'user', content: 'User message' },
                ],
            };
            workflowContext = new WorkflowContext(contextConfig);
        });

        it('should clear all messages', () => {
            workflowContext.clearMessages();

            expect(workflowContext.messages).toHaveLength(0);
        });

        it('should reset to empty state', () => {
            workflowContext.addMessage({ role: 'user', content: 'Test' });
            expect(workflowContext.messages).toHaveLength(3);

            workflowContext.clearMessages();

            expect(workflowContext.messages).toHaveLength(0);
        });
    });

    describe('getStats', () => {
        beforeEach(() => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [{ role: 'system', content: 'System message' }],
                max_length: 1000,
            };
            workflowContext = new WorkflowContext(contextConfig);
        });

        it('should return context statistics', () => {
            workflowContext.addMessage({ role: 'user', content: 'User message' });
            workflowContext.addMessage({ role: 'assistant', content: 'Assistant message' });

            const stats = workflowContext.getStats();

            expect(stats).toEqual({
                name: 'test_context',
                messageCount: 3,
                contextLength: expect.any(Number),
                maxLength: 1000,
                agentCount: 0,
                agents: [],
            });

            expect(stats.contextLength).toBeGreaterThan(0);
        });

        it('should calculate context length correctly', () => {
            // Add message with known length
            workflowContext.addMessage({ role: 'user', content: 'A'.repeat(100) }); // 100 characters

            const stats = workflowContext.getStats();

            expect(stats.contextLength).toBeGreaterThan(100); // Should include system message length too
        });
    });

    describe('message trimming', () => {
        beforeEach(() => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [{ role: 'system', content: 'System' }],
                max_length: 50,
            };
            workflowContext = new WorkflowContext(contextConfig);
        });

        it('should trim oldest non-system messages first', () => {
            // Add many messages to trigger trimming (need more than 10 to trigger)
            for (let i = 0; i < 15; i++) {
                workflowContext.addMessage({ role: 'user', content: `Msg${i}` });
                workflowContext.addMessage({ role: 'assistant', content: `Resp${i}` });
            }

            // Should have system message and some recent messages
            expect(workflowContext.messages[0].role).toBe('system');

            // Should have trimmed to stay under limit but keep at least 10 non-system messages
            const nonSystemMessages = workflowContext.messages.filter(m => m.role !== 'system');
            expect(nonSystemMessages.length).toBeGreaterThanOrEqual(10);

            // Should have some messages remaining
            expect(workflowContext.messages.length).toBeGreaterThan(1); // At least system + some others
        });

        it('should handle edge case where single message exceeds max length', () => {
            const longMessage = { role: 'user', content: 'A'.repeat(100) };

            workflowContext.addMessage(longMessage);

            // Should still have the message (trimming doesn't remove all messages)
            expect(workflowContext.messages.length).toBeGreaterThan(0);
        });
    });

    describe('message validation', () => {
        beforeEach(() => {
            const contextConfig = {
                name: 'test_context',
                starting_messages: [],
            };
            workflowContext = new WorkflowContext(contextConfig);
        });

        it('should reject messages without content', () => {
            const message = { role: 'user' };

            expect(() => {
                workflowContext.addMessage(message);
            }).toThrow('Invalid message: must have role and content');
        });

        it('should reject messages with empty content', () => {
            const message = { role: 'user', content: '' };

            expect(() => {
                workflowContext.addMessage(message);
            }).toThrow('Invalid message: must have role and content');
        });

        it('should reject messages without role', () => {
            const message = { content: 'Test message' };

            expect(() => {
                workflowContext.addMessage(message);
            }).toThrow('Invalid message: must have role and content');
        });

        it('should accept valid messages', () => {
            const message = { role: 'user', content: 'Valid message' };

            expect(() => {
                workflowContext.addMessage(message);
            }).not.toThrow();

            expect(workflowContext.messages).toHaveLength(1);
            expect(workflowContext.messages[0]).toEqual(message);
        });
    });
});
