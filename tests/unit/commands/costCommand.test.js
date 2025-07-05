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
                getCostSummary: vi.fn().mockReturnValue({
                    models: {
                        'gpt-4': {
                            cached_tokens: 100,
                            prompt_tokens: 1500,
                            completion_tokens: 800,
                            total_tokens: 2400,
                            reasoning_tokens: 50,
                            inputCost: 0.0014,
                            outputCost: 0.0032,
                            cachedCost: 0.00001,
                            totalCost: 0.00461,
                        },
                        'gpt-3.5-turbo': {
                            cached_tokens: 50,
                            prompt_tokens: 1000,
                            completion_tokens: 500,
                            total_tokens: 1550,
                            reasoning_tokens: 25,
                            inputCost: 0.00095,
                            outputCost: 0.002,
                            cachedCost: 0.000005,
                            totalCost: 0.002955,
                        },
                    },
                    grandTotal: 0.007565,
                    modelCount: 2,
                }),
                getModelPricing: vi.fn().mockImplementation(modelName => {
                    if (modelName === 'gpt-4') {
                        return {
                            inputPricePerMillionTokens: 1.0,
                            outputPricePerMillionTokens: 4.0,
                            cachedPricePerMillionTokens: 0.1,
                            provider: 'OpenAI',
                        };
                    }
                    if (modelName === 'gpt-3.5-turbo') {
                        return {
                            inputPricePerMillionTokens: 1.0,
                            outputPricePerMillionTokens: 4.0,
                            cachedPricePerMillionTokens: 0.1,
                            provider: 'OpenAI',
                        };
                    }
                    return null;
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

            // Should call getCostSummary
            expect(mockContext.costsManager.getCostSummary).toHaveBeenCalled();

            // Should display cost information
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('💰 Accumulated API Costs & Usage:')
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('🤖 gpt-4:'),
                'Model:'
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Grand Total Cost:'),
                'Total:'
            );
        });

        it('should handle empty costs', async () => {
            mockContext.costsManager.getCostSummary.mockReturnValue({
                models: {},
                grandTotal: 0,
                modelCount: 0,
            });

            const result = await costCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call getCostSummary
            expect(mockContext.costsManager.getCostSummary).toHaveBeenCalled();

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
                expect.stringContaining('🤖 gpt-3.5-turbo:'),
                'Model:'
            );
            expect(mockContext.consoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Total Tokens: 1,550'),
                ' '
            );
        });

        it('should handle arguments (ignored)', async () => {
            const result = await costCommand.implementation('some args', mockContext);

            expect(result).toBe(true);

            // Args are ignored, should still work
            expect(mockContext.costsManager.getCostSummary).toHaveBeenCalled();
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
            mockContext.costsManager.getCostSummary.mockImplementation(() => {
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
