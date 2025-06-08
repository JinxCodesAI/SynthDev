// tests/mocks/openai.js
import { vi } from 'vitest';

export function createMockOpenAI() {
    return {
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [
                        {
                            message: {
                                content: 'Mock AI response',
                                role: 'assistant',
                            },
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
