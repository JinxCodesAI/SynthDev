// tests/mocks/consoleInterface.js
import { vi } from 'vitest';

export function createMockConsoleInterface() {
    return {
        showMessage: vi.fn(),
        showError: vi.fn(),
        showToolResult: vi.fn(),
        showThinking: vi.fn(),
        showExecutingTools: vi.fn(),
        pauseInput: vi.fn(),
        resumeInput: vi.fn(),
        prompt: vi.fn(),
        newLine: vi.fn(),
    };
}
