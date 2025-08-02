// tests/unit/core/aiAPIClient.messageOrdering.test.js
import { describe, it, expect } from 'vitest';
import AIAPIClient from '../../../src/core/ai/aiAPIClient.js';

describe('AIAPIClient Message Ordering', () => {
    describe('sortMessagesForToolCalls', () => {
        it('should move tool message directly after corresponding assistant message', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'user', content: 'Another message' },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
            ];

            const result = AIAPIClient.sortMessagesForToolCalls(messages);

            expect(result).toEqual([
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
                { role: 'user', content: 'Another message' },
            ]);
        });

        it('should handle multiple tool calls in correct order', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [
                        { id: 'call_123', function: { name: 'tool_1' } },
                        { id: 'call_456', function: { name: 'tool_2' } },
                    ],
                },
                { role: 'user', content: 'Another message' },
                { role: 'tool', tool_call_id: 'call_456', content: 'Tool 2 result' },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool 1 result' },
            ];

            const result = AIAPIClient.sortMessagesForToolCalls(messages);

            expect(result).toEqual([
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [
                        { id: 'call_123', function: { name: 'tool_1' } },
                        { id: 'call_456', function: { name: 'tool_2' } },
                    ],
                },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool 1 result' },
                { role: 'tool', tool_call_id: 'call_456', content: 'Tool 2 result' },
                { role: 'user', content: 'Another message' },
            ]);
        });

        it('should not modify already correctly ordered messages', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
                { role: 'assistant', content: 'Final response' },
            ];

            const result = AIAPIClient.sortMessagesForToolCalls(messages);

            expect(result).toEqual(messages);
        });

        it('should handle messages with no tool calls', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi there!' },
                { role: 'user', content: 'How are you?' },
                { role: 'assistant', content: 'I am fine, thank you!' },
            ];

            const result = AIAPIClient.sortMessagesForToolCalls(messages);

            expect(result).toEqual(messages);
        });

        it('should handle orphaned tool messages gracefully', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                { role: 'tool', tool_call_id: 'call_orphan', content: 'Orphaned tool result' },
                { role: 'assistant', content: 'Response' },
            ];

            const result = AIAPIClient.sortMessagesForToolCalls(messages);

            // Should not crash and leave orphaned tool message in place
            expect(result).toEqual(messages);
        });

        it('should not mutate the original array', () => {
            const messages = [
                { role: 'user', content: 'Hello' },
                {
                    role: 'assistant',
                    tool_calls: [{ id: 'call_123', function: { name: 'test_tool' } }],
                },
                { role: 'user', content: 'Another message' },
                { role: 'tool', tool_call_id: 'call_123', content: 'Tool result' },
            ];
            const originalMessages = [...messages];

            const result = AIAPIClient.sortMessagesForToolCalls(messages);

            // Original array should be unchanged
            expect(messages).toEqual(originalMessages);
            // Result should be different
            expect(result).not.toEqual(messages);
        });

        it('should handle complex scenario with multiple assistant messages and tool calls', () => {
            const messages = [
                { role: 'user', content: 'Start' },
                { role: 'assistant', tool_calls: [{ id: 'call_1', function: { name: 'tool_a' } }] },
                { role: 'assistant', tool_calls: [{ id: 'call_2', function: { name: 'tool_b' } }] },
                { role: 'user', content: 'Middle' },
                { role: 'tool', tool_call_id: 'call_2', content: 'Tool B result' },
                { role: 'tool', tool_call_id: 'call_1', content: 'Tool A result' },
                { role: 'user', content: 'End' },
            ];

            const result = AIAPIClient.sortMessagesForToolCalls(messages);

            expect(result).toEqual([
                { role: 'user', content: 'Start' },
                { role: 'assistant', tool_calls: [{ id: 'call_1', function: { name: 'tool_a' } }] },
                { role: 'tool', tool_call_id: 'call_1', content: 'Tool A result' },
                { role: 'assistant', tool_calls: [{ id: 'call_2', function: { name: 'tool_b' } }] },
                { role: 'tool', tool_call_id: 'call_2', content: 'Tool B result' },
                { role: 'user', content: 'Middle' },
                { role: 'user', content: 'End' },
            ]);
        });
    });
});
