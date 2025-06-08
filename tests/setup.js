// Global test setup
import { vi, afterEach } from 'vitest';

// Mock console methods to avoid noise in tests
globalThis.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
};

// Mock process.exit to prevent tests from exiting
vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit() was called');
});

// Reset all mocks after each test
afterEach(() => {
    vi.clearAllMocks();
});
