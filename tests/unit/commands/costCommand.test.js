// tests/unit/commands/costCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CostCommand from '../../../src/commands/info/CostCommand.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('CostCommand', () => {
    let costCommand;
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
            costsManager: {
                getTotalCosts: vi.fn().mockReturnValue({
                    'gpt-4': {
                        cached_tokens: 100,
                        prompt_tokens: 1500,
                        completion_tokens: 800,
                        total_tokens: 2400,
                        reasoning_tokens: 50,
                    },
                    'gpt-3.5-turbo': {
                        cached_tokens: 50,
                        prompt_tokens: 1000,
                        completion_tokens: 500,
                        total_tokens: 1550,
                        reasoning_tokens: 25,
                    },
                }),
            },
            consoleInterface: {
                showMessage: vi.fn(),
                newLine: vi.fn(),
            },
        };

        // Create CostCommand instance
        costCommand = new CostCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(costCommand.name).toBe('cost');
            expect(costCommand.description).toBe('Show accumulated API costs');
            expect(costCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = costCommand.getRequiredDependencies();
            expect(dependencies).toContain('costsManager');
        });
    });

    describe('implementation', () => {
        it('should display total costs by default', async () => {
            const result = await costCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call getTotalCosts
            expect(mockContext.costsManager.getTotalCosts).toHaveBeenCalled();

            // Should display cost information
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('📊 Accumulated API Costs By Model:')
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('gpt-4:'),
                'Model:'
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '  Cached Tokens: 100',
                ' '
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '  Prompt Tokens: 1500',
                ' '
            );
        });

        it('should handle empty costs', async () => {
            mockContext.costsManager.getTotalCosts.mockReturnValue({});

            const result = await costCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call getTotalCosts
            expect(mockContext.costsManager.getTotalCosts).toHaveBeenCalled();

            // Should display no data message
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('📊 No API usage data available yet.')
            );
        });

        it('should display model breakdown for total costs', async () => {
            const result = await costCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display model-specific information
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('gpt-3.5-turbo:'),
                'Model:'
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                '  Total Tokens: 1550',
                ' '
            );
        });

        it('should handle arguments (ignored)', async () => {
            const result = await costCommand.implementation('some args', mockContext);

            expect(result).toBe(true);

            // Args are ignored, should still work
            expect(mockContext.costsManager.getTotalCosts).toHaveBeenCalled();
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = costCommand.getUsage();
            expect(usage).toBe('/cost');
        });
    });

    describe('error handling', () => {
        it('should handle costsManager errors', async () => {
            mockContext.costsManager.getTotalCosts.mockImplementation(() => {
                throw new Error('Cost manager error');
            });

            // The command doesn't have error handling, so it will throw
            await expect(costCommand.implementation('', mockContext)).rejects.toThrow(
                'Cost manager error'
            );
        });

        it('should handle missing costsManager', async () => {
            const contextWithoutCosts = {
                costsManager: null,
                consoleInterface: mockContext.consoleInterface,
            };

            // The command doesn't check for null costsManager, so it will throw
            await expect(costCommand.implementation('', contextWithoutCosts)).rejects.toThrow();
        });
    });
});
