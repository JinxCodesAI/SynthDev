// tests/mocks/openai.js
import { vi } from 'vitest';

export function createMockOpenAI() {
    return {
        baseURL: 'https://api.test.com/v1',
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    id: 'chatcmpl-test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'test-model',
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: 'Test response',
                                tool_calls: null,
                                reasoning_content: null,
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: {
                        prompt_tokens: 10,
                        completion_tokens: 5,
                        total_tokens: 15,
                    },
                }),
            },
        },
    };
}

export function createMockOpenAIWithToolCalls() {
    return {
        baseURL: 'https://api.test.com/v1',
        chat: {
            completions: {
                create: vi
                    .fn()
                    .mockResolvedValueOnce({
                        id: 'chatcmpl-test-1',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'test-model',
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: null,
                                    tool_calls: [
                                        {
                                            id: 'call_test_1',
                                            type: 'function',
                                            function: {
                                                name: 'test_tool',
                                                arguments: '{"param": "value"}',
                                            },
                                        },
                                    ],
                                    reasoning_content: null,
                                },
                                finish_reason: 'tool_calls',
                            },
                        ],
                        usage: {
                            prompt_tokens: 20,
                            completion_tokens: 10,
                            total_tokens: 30,
                        },
                    })
                    .mockResolvedValueOnce({
                        id: 'chatcmpl-test-2',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'test-model',
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: 'Final response after tool execution',
                                    tool_calls: null,
                                    reasoning_content: null,
                                },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: {
                            prompt_tokens: 25,
                            completion_tokens: 8,
                            total_tokens: 33,
                        },
                    }),
            },
        },
    };
}

export function createMockOpenAIWithReasoning() {
    return {
        baseURL: 'https://api.test.com/v1',
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    id: 'chatcmpl-test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'test-model',
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: 'Test response',
                                tool_calls: null,
                                reasoning_content: 'This is the reasoning process...',
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: {
                        prompt_tokens: 15,
                        completion_tokens: 10,
                        total_tokens: 25,
                    },
                }),
            },
        },
    };
}

export function createMockOpenAIWithError() {
    return {
        baseURL: 'https://api.test.com/v1',
        chat: {
            completions: {
                create: vi.fn().mockRejectedValue(new Error('API Error: Rate limit exceeded')),
            },
        },
    };
}
