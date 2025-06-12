// tests/mocks/consoleInterface.js
import { vi } from 'vitest';

export function createMockConsoleInterface() {
    return {
        showMessage: vi.fn(),
        showError: vi.fn(),
        showToolResult: vi.fn(),
        showThinking: vi.fn(),
        showExecutingTools: vi.fn(),
        showToolExecution: vi.fn(),
        showToolCancelled: vi.fn(),
        pauseInput: vi.fn(),
        resumeInput: vi.fn(),
        prompt: vi.fn(),
        promptForConfirmation: vi.fn().mockResolvedValue(true),
        newLine: vi.fn(),
    };
}
