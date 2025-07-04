import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { pathToFileURL } from 'url';
import WorkflowConfig from '../../../src/workflow/WorkflowConfig.js';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('url');
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

describe('WorkflowConfig', () => {
    let workflowConfig;
    let mockExistsSync;
    let mockReadFileSync;
    let mockJoin;
    let mockDirname;
    let mockBasename;
    let mockResolve;
    let mockPathToFileURL;

    beforeEach(() => {
        vi.clearAllMocks();

        mockExistsSync = vi.mocked(existsSync);
        mockReadFileSync = vi.mocked(readFileSync);
        mockJoin = vi.mocked(join);
        mockDirname = vi.mocked(dirname);
        mockBasename = vi.mocked(basename);
        mockResolve = vi.mocked(resolve);
        mockPathToFileURL = vi.mocked(pathToFileURL);

        // Default mock implementations
        mockJoin.mockImplementation((...args) => args.join('/'));
        mockDirname.mockImplementation(path => path.split('/').slice(0, -1).join('/'));
        mockBasename.mockImplementation((path, ext) => {
            const name = path.split('/').pop();
            return ext ? name.replace(ext, '') : name;
        });
        mockResolve.mockImplementation(path => `/absolute/${path}`);
        mockPathToFileURL.mockImplementation(path => ({ href: `file://${path}` }));
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with config path', () => {
            workflowConfig = new WorkflowConfig('./test-config.json');
            expect(workflowConfig.configPath).toBe('./test-config.json');
            expect(workflowConfig.config).toBeNull();
            expect(workflowConfig.workflowName).toBeNull();
            expect(workflowConfig.scriptModule).toBeNull();
        });
    });

    describe('load', () => {
        beforeEach(() => {
            workflowConfig = new WorkflowConfig('./test-config.json');
        });

        it('should load valid workflow configuration', async () => {
            const mockConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            const result = await workflowConfig.load();

            expect(mockExistsSync).toHaveBeenCalledWith('./test-config.json');
            expect(mockReadFileSync).toHaveBeenCalledWith('./test-config.json', 'utf8');
            expect(result).toEqual(mockConfig);
            expect(workflowConfig.getWorkflowName()).toBe('test_workflow');
        });

        it('should throw error if config file does not exist', async () => {
            mockExistsSync.mockReturnValue(false);

            await expect(workflowConfig.load()).rejects.toThrow(
                'Workflow configuration not found: ./test-config.json'
            );
        });

        it('should throw error if config is invalid JSON', async () => {
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue('invalid json');

            await expect(workflowConfig.load()).rejects.toThrow();
        });

        it('should load script module when available', async () => {
            const mockConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            const mockScriptModule = {
                testFunction: vi.fn(),
                anotherFunction: vi.fn(),
            };

            mockExistsSync.mockImplementation(path => {
                if (path === './test-config.json') {
                    return true;
                }
                if (path.includes('script.js')) {
                    return true;
                }
                return false;
            });
            mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            // Mock dynamic import by directly setting the script module
            const originalLoadScriptModule = workflowConfig._loadScriptModule;
            workflowConfig._loadScriptModule = vi.fn().mockImplementation(async function () {
                this.scriptModule = mockScriptModule;
            });

            const result = await workflowConfig.load();

            expect(result).toEqual(mockConfig);
            expect(workflowConfig.getScriptModule()).toEqual(mockScriptModule);

            // Restore original method
            workflowConfig._loadScriptModule = originalLoadScriptModule;
        });

        it('should handle script module loading failure gracefully', async () => {
            const mockConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockExistsSync.mockImplementation(path => {
                if (path === './test-config.json') {
                    return true;
                }
                if (path.includes('script.js')) {
                    return true;
                }
                return false;
            });
            mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            // Mock dynamic import failure
            const originalImport = global.import;
            global.import = vi.fn().mockRejectedValue(new Error('Import failed'));

            const result = await workflowConfig.load();

            expect(result).toEqual(mockConfig);
            expect(workflowConfig.getScriptModule()).toBeNull();

            // Restore original import
            global.import = originalImport;
        });
    });

    describe('validation', () => {
        beforeEach(() => {
            workflowConfig = new WorkflowConfig('./test-config.json');
            mockExistsSync.mockReturnValue(true);
        });

        it('should validate required fields', async () => {
            const invalidConfig = {
                workflow_name: 'test_workflow',
                // missing required fields
            };

            mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

            await expect(workflowConfig.load()).rejects.toThrow('Missing required field');
        });

        it('should validate input parameter definition', async () => {
            const invalidConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input' }, // missing type and description
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

            await expect(workflowConfig.load()).rejects.toThrow(
                'input parameter must have a valid type'
            );
        });

        it('should validate contexts configuration', async () => {
            const invalidConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [], // empty contexts
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

            await expect(workflowConfig.load()).rejects.toThrow(
                'At least one context must be defined'
            );
        });

        it('should validate agents configuration', async () => {
            const invalidConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [
                    { agent_role: 'test_agent', context: 'nonexistent_context', role: 'assistant' },
                ],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

            await expect(workflowConfig.load()).rejects.toThrow('references unknown context');
        });

        it('should validate states configuration', async () => {
            const invalidConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'stop' }], // missing start state
            };

            mockReadFileSync.mockReturnValue(JSON.stringify(invalidConfig));

            await expect(workflowConfig.load()).rejects.toThrow(
                'Workflow must have a "start" state'
            );
        });
    });

    describe('getters', () => {
        beforeEach(() => {
            workflowConfig = new WorkflowConfig('./test-config.json');
        });

        it('should return null for unloaded config', () => {
            expect(workflowConfig.getConfig()).toBeNull();
            expect(workflowConfig.getWorkflowName()).toBeNull();
            expect(workflowConfig.getScriptModule()).toBeNull();
        });

        it('should return metadata for loaded config', async () => {
            const mockConfig = {
                workflow_name: 'test_workflow',
                description: 'Test workflow',
                input: { name: 'test_input', type: 'string', description: 'Test input' },
                output: { name: 'test_output', type: 'string', description: 'Test output' },
                contexts: [{ name: 'test_context', starting_messages: [], max_length: 1000 }],
                agents: [{ agent_role: 'test_agent', context: 'test_context', role: 'assistant' }],
                states: [{ name: 'start' }, { name: 'stop' }],
            };

            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            await workflowConfig.load();

            const metadata = workflowConfig.getMetadata();
            expect(metadata).toEqual({
                name: 'test_workflow',
                description: 'Test workflow',
                input: mockConfig.input,
                output: mockConfig.output,
                contextCount: 1,
                agentCount: 1,
                stateCount: 2,
            });
        });
    });
});
