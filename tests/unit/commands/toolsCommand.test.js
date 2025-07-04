// tests/unit/commands/toolsCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ToolsCommand from '../../../commands/info/ToolsCommand.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('ToolsCommand', () => {
    let toolsCommand;
    let mockContext;
    let mockLogger;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            debug: vi.fn(),
            user: vi.fn(),
            info: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../src/core/managers/logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Create mock context
        mockContext = {
            toolManager: {
                getTools: vi.fn().mockReturnValue([
                    {
                        type: 'function',
                        function: {
                            name: 'read_file',
                            description: 'Read contents of a file',
                            parameters: {
                                type: 'object',
                                properties: {
                                    file_path: { type: 'string' },
                                },
                                required: ['file_path'],
                            },
                        },
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'write_file',
                            description: 'Write content to a file',
                            parameters: {
                                type: 'object',
                                properties: {
                                    file_path: { type: 'string' },
                                    content: { type: 'string' },
                                },
                                required: ['file_path', 'content'],
                            },
                        },
                    },
                ]),
                getToolDefinition: vi.fn().mockImplementation(toolName => ({
                    auto_run: true,
                    name: toolName,
                    category: 'file',
                })),
            },
        };

        // Create ToolsCommand instance
        toolsCommand = new ToolsCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(toolsCommand.name).toBe('tools');
            expect(toolsCommand.description).toBe('List available tools');
            expect(toolsCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = toolsCommand.getRequiredDependencies();
            expect(dependencies).toContain('toolManager');
        });
    });

    describe('implementation', () => {
        it('should display available tools', async () => {
            const result = await toolsCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call getTools and getToolDefinition
            expect(mockContext.toolManager.getTools).toHaveBeenCalled();
            expect(mockContext.toolManager.getToolDefinition).toHaveBeenCalledWith('read_file');
            expect(mockContext.toolManager.getToolDefinition).toHaveBeenCalledWith('write_file');

            // Should display tools header
            expect(mockLogger.user).toHaveBeenCalledWith('🔧 Available Tools:');
            expect(mockLogger.user).toHaveBeenCalledWith('─'.repeat(50));

            // Should display tool information
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('📍 read_file 🟢 Auto-run')
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Description: Read contents of a file')
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Parameters: file_path')
            );
        });

        it('should handle empty tools list', async () => {
            mockContext.toolManager.getTools.mockReturnValue([]);

            const result = await toolsCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display no tools message
            expect(mockLogger.info).toHaveBeenCalledWith('🔧 No tools available');
        });

        it('should handle args parameter (unused)', async () => {
            const result = await toolsCommand.implementation('some args', mockContext);

            expect(result).toBe(true);
            // Args should be ignored, but command should still work
            expect(mockContext.toolManager.getTools).toHaveBeenCalled();
        });

        it('should display tool parameters', async () => {
            const result = await toolsCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display parameter information
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Parameters: file_path')
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Parameters: file_path, content')
            );
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = toolsCommand.getUsage();
            expect(usage).toBe('/tools');
        });
    });

    describe('error handling', () => {
        it('should handle toolManager errors', async () => {
            mockContext.toolManager.getTools.mockImplementation(() => {
                throw new Error('Tool manager error');
            });

            // The command doesn't have error handling, so it will throw
            await expect(toolsCommand.implementation('', mockContext)).rejects.toThrow(
                'Tool manager error'
            );
        });

        it('should handle missing toolManager', async () => {
            const contextWithoutTools = {
                toolManager: null,
            };

            // The command doesn't check for null toolManager, so it will throw
            await expect(toolsCommand.implementation('', contextWithoutTools)).rejects.toThrow();
        });
    });

    describe('tool display formatting', () => {
        it('should handle tools with auto_run false', async () => {
            mockContext.toolManager.getToolDefinition.mockReturnValue({
                auto_run: false,
                name: 'manual_tool',
                category: 'utility',
            });

            const result = await toolsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('🔴 Requires confirmation')
            );
        });

        it('should handle tools without parameters', async () => {
            mockContext.toolManager.getTools.mockReturnValue([
                {
                    type: 'function',
                    function: {
                        name: 'simple_tool',
                        description: 'A simple tool',
                        parameters: {
                            type: 'object',
                            properties: {},
                        },
                    },
                },
            ]);

            const result = await toolsCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('📍 simple_tool'));
        });
    });
});
