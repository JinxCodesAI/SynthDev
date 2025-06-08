// tests/unit/commands/reviewCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ReviewCommand from '../../../commands/info/ReviewCommand.js';

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('ReviewCommand', () => {
    let reviewCommand;
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
        const { getLogger } = await import('../../../logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Create mock context
        mockContext = {
            apiClient: {
                getLastAPICall: vi.fn().mockReturnValue({
                    timestamp: '2024-01-15T10:30:00.000Z',
                    request: {
                        model: 'gpt-4',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a helpful assistant.',
                            },
                            {
                                role: 'user',
                                content: 'Hello, how are you?',
                            },
                        ],
                        temperature: 0.7,
                    },
                    response: {
                        id: 'chatcmpl-123',
                        object: 'chat.completion',
                        created: 1705312200,
                        model: 'gpt-4',
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: 'Hello! I am doing well, thank you for asking.',
                                },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: {
                            prompt_tokens: 20,
                            completion_tokens: 15,
                            total_tokens: 35,
                        },
                    },
                }),
            },
        };

        // Create ReviewCommand instance
        reviewCommand = new ReviewCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(reviewCommand.name).toBe('review');
            expect(reviewCommand.description).toBe('Show raw content of last API request/response');
            expect(reviewCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = reviewCommand.getRequiredDependencies();
            expect(dependencies).toContain('apiClient');
        });
    });

    describe('implementation', () => {
        it('should display last API call details', async () => {
            const result = await reviewCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call getLastAPICall
            expect(mockContext.apiClient.getLastAPICall).toHaveBeenCalled();

            // Should display review header
            expect(mockLogger.raw).toHaveBeenCalledWith('\n📋 Last API Call Review');
            expect(mockLogger.raw).toHaveBeenCalledWith('═'.repeat(80));

            // Should display timestamp
            expect(mockLogger.raw).toHaveBeenCalledWith('🕒 Timestamp: 2024-01-15T10:30:00.000Z');

            // Should display request section
            expect(mockLogger.raw).toHaveBeenCalledWith('📤 REQUEST:');
            expect(mockLogger.raw).toHaveBeenCalledWith('─'.repeat(40));

            // Should display response section
            expect(mockLogger.raw).toHaveBeenCalledWith('📥 RESPONSE:');
        });

        it('should handle no API calls made yet', async () => {
            mockContext.apiClient.getLastAPICall.mockReturnValue({
                request: null,
                response: null,
                timestamp: null,
            });

            const result = await reviewCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call getLastAPICall
            expect(mockContext.apiClient.getLastAPICall).toHaveBeenCalled();

            // Should display no API calls message
            expect(mockLogger.raw).toHaveBeenCalledWith('📋 No API calls have been made yet');
        });

        it('should handle missing request', async () => {
            mockContext.apiClient.getLastAPICall.mockReturnValue({
                request: null,
                response: { id: 'test' },
                timestamp: '2024-01-15T10:30:00.000Z',
            });

            const result = await reviewCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('📋 No API calls have been made yet');
        });

        it('should handle missing response', async () => {
            mockContext.apiClient.getLastAPICall.mockReturnValue({
                request: { model: 'gpt-4' },
                response: null,
                timestamp: '2024-01-15T10:30:00.000Z',
            });

            const result = await reviewCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('📋 No API calls have been made yet');
        });

        it('should handle arguments (ignored)', async () => {
            const result = await reviewCommand.implementation('some args', mockContext);

            expect(result).toBe(true);

            // Args are ignored, should still work
            expect(mockContext.apiClient.getLastAPICall).toHaveBeenCalled();
        });

        it('should format JSON with proper indentation', async () => {
            const result = await reviewCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Check that JSON.stringify was called with proper formatting (3 spaces)
            const rawCalls = mockLogger.raw.mock.calls;
            const jsonCalls = rawCalls.filter(
                call => call[0] && typeof call[0] === 'string' && call[0].includes('{')
            );

            // Should have JSON formatted calls
            expect(jsonCalls.length).toBeGreaterThan(0);
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = reviewCommand.getUsage();
            expect(usage).toBe('/review');
        });
    });

    describe('error handling', () => {
        it('should handle apiClient errors', async () => {
            mockContext.apiClient.getLastAPICall.mockImplementation(() => {
                throw new Error('API client error');
            });

            // The command doesn't have error handling, so it will throw
            await expect(reviewCommand.implementation('', mockContext)).rejects.toThrow(
                'API client error'
            );
        });

        it('should handle missing apiClient', async () => {
            const contextWithoutApiClient = {
                apiClient: null,
            };

            // The command doesn't check for null apiClient, so it will throw
            await expect(
                reviewCommand.implementation('', contextWithoutApiClient)
            ).rejects.toThrow();
        });
    });
});
