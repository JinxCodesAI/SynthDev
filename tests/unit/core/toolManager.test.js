// tests/unit/core/toolManager.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ToolManager from '../../../src/core/managers/toolManager.js';
import { createMockConsoleInterface } from '../../mocks/consoleInterface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ToolManager', () => {
    let toolManager;
    let mockConsole;
    let originalReadFileSync;
    let originalReaddirSync;
    let originalExistsSync;

    beforeEach(() => {
        toolManager = new ToolManager();
        mockConsole = createMockConsoleInterface();
        vi.clearAllMocks();

        // Store original fs functions
        originalReadFileSync = vi.fn();
        originalReaddirSync = vi.fn();
        originalExistsSync = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with empty collections', () => {
            expect(toolManager.tools).toEqual([]);
            expect(toolManager.toolImplementations).toBeInstanceOf(Map);
            expect(toolManager.toolDefinitions).toBeInstanceOf(Map);
            expect(toolManager.toolCategories).toBeInstanceOf(Map);
            expect(toolManager.loadingErrors).toEqual([]);
            expect(toolManager.logger).toBeDefined();
        });
    });

    describe('getTools', () => {
        it('should return tools array', () => {
            const result = toolManager.getTools();
            expect(result).toEqual([]);
            expect(result).toBe(toolManager.tools);
        });
    });

    describe('getToolsCount', () => {
        it('should return correct count', () => {
            expect(toolManager.getToolsCount()).toBe(0);

            // Add a mock tool
            toolManager.tools.push({ name: 'test_tool' });
            expect(toolManager.getToolsCount()).toBe(1);
        });
    });

    describe('getToolDefinition', () => {
        it('should return tool definition if exists', () => {
            const mockDefinition = { name: 'test_tool', description: 'Test tool' };
            toolManager.toolDefinitions.set('test_tool', mockDefinition);

            expect(toolManager.getToolDefinition('test_tool')).toBe(mockDefinition);
        });

        it('should return undefined if tool does not exist', () => {
            expect(toolManager.getToolDefinition('nonexistent_tool')).toBeUndefined();
        });
    });

    describe('getToolsByCategory', () => {
        it('should return tools in specified category', () => {
            toolManager.toolCategories.set('file', ['read_file', 'write_file']);
            toolManager.toolCategories.set('utility', ['get_time']);

            expect(toolManager.getToolsByCategory('file')).toEqual(['read_file', 'write_file']);
            expect(toolManager.getToolsByCategory('utility')).toEqual(['get_time']);
        });

        it('should return empty array for non-existent category', () => {
            expect(toolManager.getToolsByCategory('nonexistent')).toEqual([]);
        });
    });

    describe('getCategories', () => {
        it('should return all category names', () => {
            toolManager.toolCategories.set('file', ['read_file']);
            toolManager.toolCategories.set('utility', ['get_time']);

            const categories = toolManager.getCategories();
            expect(categories).toContain('file');
            expect(categories).toContain('utility');
            expect(categories).toHaveLength(2);
        });

        it('should return empty array when no categories exist', () => {
            expect(toolManager.getCategories()).toEqual([]);
        });
    });

    describe('getLoadingErrors', () => {
        it('should return loading errors array', () => {
            const mockError = { tool: 'test_tool', message: 'Test error' };
            toolManager.loadingErrors.push(mockError);

            expect(toolManager.getLoadingErrors()).toContain(mockError);
        });
    });

    describe('hasToolDefinition', () => {
        it('should return true if tool exists', () => {
            toolManager.toolDefinitions.set('test_tool', {});
            expect(toolManager.hasToolDefinition('test_tool')).toBe(true);
        });

        it('should return false if tool does not exist', () => {
            expect(toolManager.hasToolDefinition('nonexistent_tool')).toBe(false);
        });
    });

    describe('executeToolCall', () => {
        beforeEach(() => {
            // Set up a mock tool for testing
            const mockDefinition = {
                name: 'test_tool',
                description: 'Test tool',
                auto_run: true,
                requires_backup: false,
            };
            const mockImplementation = vi.fn().mockResolvedValue({
                message: 'Tool executed successfully',
                data: 'test data',
            });

            toolManager.toolDefinitions.set('test_tool', mockDefinition);
            toolManager.toolImplementations.set('test_tool', mockImplementation);
        });

        it('should execute tool successfully', async () => {
            const toolCall = {
                id: 'test-call-1',
                function: {
                    name: 'test_tool',
                    arguments: JSON.stringify({ param1: 'value1' }),
                },
            };

            const mockContext = { currentRole: 'test_role' };
            const result = await toolManager.executeToolCall(
                toolCall,
                mockConsole,
                null,
                mockContext
            );

            expect(result.role).toBe('tool');
            expect(result.tool_call_id).toBe('test-call-1');

            const content = JSON.parse(result.content);
            expect(content.success).toBe(true);
            expect(content.tool_name).toBe('test_tool');
            expect(content.message).toBe('Tool executed successfully');
            expect(content.data).toBe('test data');
            expect(content.timestamp).toBeDefined();
        });

        it('should return error for non-existent tool', async () => {
            const toolCall = {
                id: 'test-call-2',
                function: {
                    name: 'nonexistent_tool',
                    arguments: JSON.stringify({}),
                },
            };

            const result = await toolManager.executeToolCall(toolCall, mockConsole);

            expect(result.role).toBe('tool');
            expect(result.tool_call_id).toBe('test-call-2');

            const content = JSON.parse(result.content);
            expect(content.success).toBe(false);
            expect(content.error).toContain('Tool not found: nonexistent_tool');
            expect(content.tool_name).toBe('nonexistent_tool');
        });

        it('should handle tool execution errors', async () => {
            const mockImplementation = vi
                .fn()
                .mockRejectedValue(new Error('Tool execution failed'));
            toolManager.toolImplementations.set('test_tool', mockImplementation);

            const toolCall = {
                id: 'test-call-3',
                function: {
                    name: 'test_tool',
                    arguments: JSON.stringify({ param1: 'value1' }),
                },
            };

            const mockContext = { currentRole: 'test_role' };
            const result = await toolManager.executeToolCall(
                toolCall,
                mockConsole,
                null,
                mockContext
            );

            expect(result.role).toBe('tool');
            expect(result.tool_call_id).toBe('test-call-3');

            const content = JSON.parse(result.content);
            expect(content.success).toBe(false);
            expect(content.error).toContain('Tool execution failed');
            expect(content.tool_name).toBe('test_tool');
            expect(content.stack).toBeDefined();
        });

        it('should handle invalid JSON arguments', async () => {
            const toolCall = {
                id: 'test-call-4',
                function: {
                    name: 'test_tool',
                    arguments: 'invalid json',
                },
            };

            // This should throw an error when parsing JSON
            await expect(toolManager.executeToolCall(toolCall, mockConsole)).rejects.toThrow();
        });

        it('should show tool execution info', async () => {
            const toolCall = {
                id: 'test-call-5',
                function: {
                    name: 'test_tool',
                    arguments: JSON.stringify({ param1: 'value1' }),
                },
            };

            const mockContext = { currentRole: 'test_role' };
            await toolManager.executeToolCall(toolCall, mockConsole, null, mockContext);

            expect(mockConsole.showToolExecution).toHaveBeenCalledWith(
                'test_tool',
                {
                    param1: 'value1',
                },
                'test_role'
            );
        });

        it('should show tool result', async () => {
            const toolCall = {
                id: 'test-call-6',
                function: {
                    name: 'test_tool',
                    arguments: JSON.stringify({ param1: 'value1' }),
                },
            };

            const mockContext = { currentRole: 'test_role' };
            await toolManager.executeToolCall(toolCall, mockConsole, null, mockContext);

            expect(mockConsole.showToolResult).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    tool_name: 'test_tool',
                    message: 'Tool executed successfully',
                    data: 'test data',
                    timestamp: expect.any(String),
                })
            );
        });
    });

    describe('loadTools integration', () => {
        it('should load actual tools from filesystem', async () => {
            // This is an integration test that loads real tools
            await toolManager.loadTools();

            // Should load some tools (we know there are tools in the project)
            expect(toolManager.getToolsCount()).toBeGreaterThan(0);
            expect(toolManager.getTools()).toBeInstanceOf(Array);
            expect(toolManager.getCategories()).toBeInstanceOf(Array);
        });

        it('should track loading errors', async () => {
            await toolManager.loadTools();

            // Loading errors should be an array (may be empty if all tools load successfully)
            expect(toolManager.getLoadingErrors()).toBeInstanceOf(Array);
        });

        it('should categorize tools', async () => {
            await toolManager.loadTools();

            if (toolManager.getToolsCount() > 0) {
                const categories = toolManager.getCategories();
                expect(categories.length).toBeGreaterThan(0);

                // Each category should have at least one tool
                for (const category of categories) {
                    const toolsInCategory = toolManager.getToolsByCategory(category);
                    expect(toolsInCategory.length).toBeGreaterThan(0);
                }
            }
        });

        it('should have valid tool definitions', async () => {
            await toolManager.loadTools();

            const tools = toolManager.getTools();
            for (const tool of tools) {
                expect(tool).toHaveProperty('type', 'function');
                expect(tool).toHaveProperty('function');
                expect(tool.function).toHaveProperty('name');
                expect(tool.function).toHaveProperty('description');
                expect(tool.function).toHaveProperty('parameters');
            }
        });
    });
});
