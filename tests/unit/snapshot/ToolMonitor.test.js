/**
 * Unit tests for ToolMonitor component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolMonitor } from '../../../src/core/snapshot/ToolMonitor.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe.sequential('ToolMonitor', () => {
    let toolMonitor;
    let mockToolManager;

    beforeEach(() => {
        mockToolManager = {
            getToolDefinition: vi.fn(),
        };

        toolMonitor = new ToolMonitor(mockToolManager);
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            expect(toolMonitor).toBeDefined();
            expect(toolMonitor.config.defaultModifiesFiles).toBe(false);
            expect(toolMonitor.config.cacheDeclarations).toBe(true);
        });

        it('should accept custom configuration', () => {
            const customConfig = {
                defaultModifiesFiles: true,
                cacheDeclarations: false,
            };

            const monitor = new ToolMonitor(mockToolManager, customConfig);
            expect(monitor.config.defaultModifiesFiles).toBe(true);
            expect(monitor.config.cacheDeclarations).toBe(false);
        });
    });

    describe('shouldCreateSnapshot', () => {
        it('should return true for write_file tool', () => {
            const result = toolMonitor.shouldCreateSnapshot('write_file');
            expect(result).toBe(true);
        });

        it('should return true for edit_file tool', () => {
            const result = toolMonitor.shouldCreateSnapshot('edit_file');
            expect(result).toBe(true);
        });

        it('should return false for read_file tool', () => {
            const result = toolMonitor.shouldCreateSnapshot('read_files');
            expect(result).toBe(false);
        });

        it('should return false for list_directory tool', () => {
            const result = toolMonitor.shouldCreateSnapshot('list_directory');
            expect(result).toBe(false);
        });

        it('should use tool definition when available', () => {
            const toolDefinition = { modifiesFiles: true };
            mockToolManager.getToolDefinition.mockReturnValue(toolDefinition);

            const result = toolMonitor.shouldCreateSnapshot('custom_tool');
            expect(result).toBe(true);
        });

        it('should use default value for unknown tools', () => {
            mockToolManager.getToolDefinition.mockReturnValue(null);

            const result = toolMonitor.shouldCreateSnapshot('unknown_tool');
            expect(result).toBe(false); // defaultModifiesFiles is false
        });

        it('should cache classification results', () => {
            // First call
            toolMonitor.shouldCreateSnapshot('write_file');
            // Second call should use cache
            const result = toolMonitor.shouldCreateSnapshot('write_file');
            expect(result).toBe(true);
            expect(toolMonitor.declarationCache.has('write_file')).toBe(true);
        });
    });

    describe('modifiesFiles', () => {
        it('should return boolean for known tools', () => {
            expect(toolMonitor.modifiesFiles('write_file')).toBe(true);
            expect(toolMonitor.modifiesFiles('read_files')).toBe(false);
        });

        it('should return "conditional" for conditional tools', () => {
            expect(toolMonitor.modifiesFiles('execute_terminal')).toBe('conditional');
            expect(toolMonitor.modifiesFiles('execute_script')).toBe('conditional');
        });
    });

    describe('classifyTool', () => {
        it('should use built-in classifications first', () => {
            const classification = toolMonitor.classifyTool('write_file');
            expect(classification.modifiesFiles).toBe(true);
            expect(classification.source).toBe('built-in');
            expect(classification.fileTargets).toContain('file_path');
        });

        it('should use tool definition when available', () => {
            const toolDefinition = {
                modifiesFiles: true,
                fileTargets: ['custom_path'],
            };

            const classification = toolMonitor.classifyTool('custom_tool', toolDefinition);
            expect(classification.modifiesFiles).toBe(true);
            expect(classification.source).toBe('tool-definition');
            expect(classification.fileTargets).toContain('custom_path');
        });

        it('should analyze tool definition for unknown tools', () => {
            const toolDefinition = {
                name: 'create_config',
                description: 'Create a configuration file',
            };

            const classification = toolMonitor.classifyTool('create_config', toolDefinition);
            expect(classification.modifiesFiles).toBe(true); // Should detect "create"
        });
    });

    describe('analyzeToolDefinition', () => {
        it('should detect modifying keywords', () => {
            const toolDefinition = {
                name: 'create_file',
                description: 'Create a new file in the system',
            };

            const analysis = toolMonitor.analyzeToolDefinition(toolDefinition);
            expect(analysis.modifiesFiles).toBe(true);
            expect(analysis.modifyingKeywords).toContain('create');
            expect(analysis.confidence).toBeGreaterThan(0.5);
        });

        it('should detect read-only keywords', () => {
            const toolDefinition = {
                name: 'show_content',
                description: 'Display the content of a file',
            };

            const analysis = toolMonitor.analyzeToolDefinition(toolDefinition);
            expect(analysis.modifiesFiles).toBe(false);
            expect(analysis.readOnlyKeywords).toContain('show');
            expect(analysis.confidence).toBeGreaterThan(0.5);
        });

        it('should extract file targets from parameters', () => {
            const toolDefinition = {
                name: 'process_file',
                schema: {
                    function: {
                        parameters: {
                            properties: {
                                file_path: { description: 'Path to the file to process' },
                                output_path: { description: 'Where to write the result' },
                            },
                        },
                    },
                },
            };

            const analysis = toolMonitor.analyzeToolDefinition(toolDefinition);
            expect(analysis.fileTargets).toContain('file_path');
            expect(analysis.fileTargets).toContain('output_path');
        });
    });

    describe('getToolMetadata', () => {
        it('should return comprehensive tool metadata', () => {
            const args = { file_path: 'test.js', content: 'console.log("test");' };
            const metadata = toolMonitor.getToolMetadata('write_file', args);

            expect(metadata).toHaveProperty('toolName', 'write_file');
            expect(metadata).toHaveProperty('classification', true);
            expect(metadata).toHaveProperty('fileTargets');
            expect(metadata).toHaveProperty('arguments', args);
            expect(metadata).toHaveProperty('timestamp');
        });
    });

    describe('extractFileTargets', () => {
        it('should extract file targets for write_file', () => {
            const args = { file_path: 'src/test.js', content: 'test content' };
            const targets = toolMonitor.extractFileTargets('write_file', args);
            expect(targets).toContain('src/test.js');
        });

        it('should extract file targets for edit_file', () => {
            const args = { file_path: 'src/app.js' };
            const targets = toolMonitor.extractFileTargets('edit_file', args);
            expect(targets).toContain('src/app.js');
        });

        it('should return empty array for tools without file targets', () => {
            const args = { query: 'test' };
            const targets = toolMonitor.extractFileTargets('calculate', args);
            expect(targets).toHaveLength(0);
        });
    });

    describe('extractFilePathsFromCommand', () => {
        it('should extract paths from terminal commands', () => {
            const command = 'cp src/file1.js dest/file2.js';
            const paths = toolMonitor.extractFilePathsFromCommand(command);
            expect(paths).toContain('src/file1.js');
            expect(paths).toContain('dest/file2.js');
        });

        it('should extract paths from touch commands', () => {
            const command = 'touch newfile.txt';
            const paths = toolMonitor.extractFilePathsFromCommand(command);
            expect(paths).toContain('newfile.txt');
        });

        it('should extract file extensions', () => {
            const command = 'echo "test" > output.log';
            const paths = toolMonitor.extractFilePathsFromCommand(command);
            expect(paths).toContain('output.log');
        });
    });

    describe('extractFilePathsFromScript', () => {
        it('should extract paths from fs.writeFileSync calls', () => {
            const script = 'fs.writeFileSync("output.json", JSON.stringify(data));';
            const paths = toolMonitor.extractFilePathsFromScript(script);
            expect(paths).toContain('output.json');
        });

        it('should extract paths from fs.readFileSync calls', () => {
            const script = 'const data = fs.readFileSync("config.json", "utf8");';
            const paths = toolMonitor.extractFilePathsFromScript(script);
            expect(paths).toContain('config.json');
        });

        it('should extract paths from require statements', () => {
            const script = 'const config = require("./config.js");';
            const paths = toolMonitor.extractFilePathsFromScript(script);
            expect(paths).toContain('./config.js');
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration and clear cache', () => {
            // First, populate cache
            toolMonitor.shouldCreateSnapshot('write_file');
            expect(toolMonitor.declarationCache.size).toBe(1);

            // Update configuration
            toolMonitor.updateConfiguration({ cacheDeclarations: false });

            expect(toolMonitor.config.cacheDeclarations).toBe(false);
            expect(toolMonitor.declarationCache.size).toBe(0);
        });
    });

    describe('getStats', () => {
        it('should return comprehensive statistics', () => {
            const stats = toolMonitor.getStats();

            expect(stats).toHaveProperty('builtInClassifications');
            expect(stats).toHaveProperty('cachedClassifications');
            expect(stats).toHaveProperty('modifyingTools');
            expect(stats).toHaveProperty('readOnlyTools');
            expect(stats).toHaveProperty('conditionalTools');

            expect(stats.modifyingTools).toContain('write_file');
            expect(stats.modifyingTools).toContain('edit_file');
            expect(stats.readOnlyTools).toContain('read_files');
            expect(stats.readOnlyTools).toContain('list_directory');
            expect(stats.conditionalTools).toContain('execute_terminal');
        });
    });
});
