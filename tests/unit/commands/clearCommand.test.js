// tests/unit/commands/clearCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClearCommand } from '../../../commands/conversation/ClearCommand.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('ClearCommand', () => {
    let clearCommand;
    let mockLogger;
    let mockContext;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../src/core/managers/logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Create mock context
        mockContext = {
            apiClient: {
                clearConversation: vi.fn(),
            },
        };

        // Create ClearCommand instance
        clearCommand = new ClearCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(clearCommand.name).toBe('clear');
            expect(clearCommand.description).toBe('Clear conversation history');
            expect(clearCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = clearCommand.getRequiredDependencies();
            expect(dependencies).toContain('apiClient');
        });
    });

    describe('implementation', () => {
        it('should clear conversation and return "clear"', async () => {
            const result = await clearCommand.implementation('', mockContext);

            expect(result).toBe('clear');
            expect(mockContext.apiClient.clearConversation).toHaveBeenCalled();
            expect(mockLogger.raw).toHaveBeenCalledWith('🧹 Conversation cleared\n');
        });

        it('should handle arguments (ignored)', async () => {
            const result = await clearCommand.implementation('some args', mockContext);

            expect(result).toBe('clear');
            expect(mockContext.apiClient.clearConversation).toHaveBeenCalled();
            expect(mockLogger.raw).toHaveBeenCalledWith('🧹 Conversation cleared\n');
        });

        it('should work with different apiClient implementations', async () => {
            const alternativeApiClient = {
                clearConversation: vi.fn(),
            };
            const alternativeContext = {
                apiClient: alternativeApiClient,
            };

            const result = await clearCommand.implementation('', alternativeContext);

            expect(result).toBe('clear');
            expect(alternativeApiClient.clearConversation).toHaveBeenCalled();
            expect(mockLogger.raw).toHaveBeenCalledWith('🧹 Conversation cleared\n');
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = clearCommand.getUsage();
            expect(usage).toBe('/clear');
        });
    });

    describe('error handling', () => {
        it('should handle apiClient errors', async () => {
            mockContext.apiClient.clearConversation.mockImplementation(() => {
                throw new Error('API client error');
            });

            // The command doesn't have error handling, so it will throw
            await expect(clearCommand.implementation('', mockContext)).rejects.toThrow(
                'API client error'
            );
        });

        it('should handle missing apiClient', async () => {
            const contextWithoutApiClient = {
                apiClient: null,
            };

            // The command doesn't check for null apiClient, so it will throw
            await expect(
                clearCommand.implementation('', contextWithoutApiClient)
            ).rejects.toThrow();
        });
    });

    describe('inheritance', () => {
        it('should extend BaseCommand', () => {
            expect(clearCommand.constructor.name).toBe('ClearCommand');
            expect(clearCommand.name).toBeDefined();
            expect(clearCommand.description).toBeDefined();
            expect(clearCommand.aliases).toBeDefined();
            expect(typeof clearCommand.execute).toBe('function');
            expect(typeof clearCommand.implementation).toBe('function');
            expect(typeof clearCommand.getRequiredDependencies).toBe('function');
        });

        it('should have timestamp property from BaseCommand', () => {
            expect(clearCommand.timestamp).toBeDefined();
            expect(typeof clearCommand.timestamp).toBe('string');
            expect(new Date(clearCommand.timestamp)).toBeInstanceOf(Date);
        });
    });
});
