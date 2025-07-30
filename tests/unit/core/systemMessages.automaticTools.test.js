import { describe, it, expect, vi, beforeEach } from 'vitest';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

// Mock the configuration loader
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        loadConfig: vi.fn(path => {
            if (path === 'defaults/environment-template.json') {
                return {
                    template: 'Test environment',
                };
            }
            return {};
        }),
        loadRolesFromDirectory: vi.fn(dirPath => {
            if (dirPath === 'roles') {
                return {
                    // Role with enabled_agents array (empty) - should get agentic tools
                    test_agentic_empty: {
                        enabled_agents: [],
                        includedTools: ['read_file'],
                    },
                    // Role with enabled_agents array (non-empty) - should get agentic tools
                    test_agentic_nonempty: {
                        enabled_agents: ['developer'],
                        includedTools: ['read_file'],
                    },
                    // Role with can_create_tasks_for array (non-empty) - should get task tools
                    test_task_tools: {
                        can_create_tasks_for: ['developer'],
                        includedTools: ['read_file'],
                    },
                    // Role with both agentic and task capabilities
                    test_both: {
                        enabled_agents: ['developer'],
                        can_create_tasks_for: ['developer'],
                        includedTools: ['read_file'],
                    },
                    // Role with no agentic or task capabilities
                    test_none: {
                        includedTools: ['read_file'],
                    },
                    // Role with enabled_agents but not array (should not get agentic tools)
                    test_not_array: {
                        enabled_agents: 'developer',
                        includedTools: ['read_file'],
                    },
                    // Role with empty can_create_tasks_for (should not get task tools)
                    test_empty_tasks: {
                        can_create_tasks_for: [],
                        includedTools: ['read_file'],
                    },
                    // Role with agentic tools explicitly excluded
                    test_agentic_excluded: {
                        enabled_agents: ['developer'],
                        includedTools: ['read_file'],
                        excludedTools: ['spawn_agent'],
                    },
                    // Role with task tools explicitly excluded
                    test_task_excluded: {
                        can_create_tasks_for: ['developer'],
                        includedTools: ['read_file'],
                        excludedTools: ['list_tasks'],
                    },
                    // Role with agentic tools already included manually
                    test_agentic_manual: {
                        enabled_agents: ['developer'],
                        includedTools: ['read_file', 'spawn_agent', 'speak_to_agent'],
                    },
                };
            }
            return {};
        }),
        clearCache: vi.fn(),
    })),
}));

describe('SystemMessages - Automatic Tool Inclusion', () => {
    beforeEach(() => {
        // Clear any cached instances
        vi.clearAllMocks();
        SystemMessages.reloadRoles();
    });

    describe('Automatic Agentic Tools', () => {
        it('should add agentic tools when enabled_agents is empty array', () => {
            const tools = SystemMessages.getIncludedTools('test_agentic_empty');
            expect(tools).toContain('spawn_agent');
            expect(tools).toContain('speak_to_agent');
            expect(tools).toContain('get_agents');
            expect(tools).toContain('read_file'); // original tool
        });

        it('should add agentic tools when enabled_agents is non-empty array', () => {
            const tools = SystemMessages.getIncludedTools('test_agentic_nonempty');
            expect(tools).toContain('spawn_agent');
            expect(tools).toContain('speak_to_agent');
            expect(tools).toContain('get_agents');
            expect(tools).toContain('read_file'); // original tool
        });

        it('should not add agentic tools when enabled_agents is not an array', () => {
            const tools = SystemMessages.getIncludedTools('test_not_array');
            expect(tools).not.toContain('spawn_agent');
            expect(tools).not.toContain('speak_to_agent');
            expect(tools).not.toContain('get_agents');
            expect(tools).toContain('read_file'); // original tool
        });

        it('should not add agentic tools when enabled_agents is not present', () => {
            const tools = SystemMessages.getIncludedTools('test_none');
            expect(tools).not.toContain('spawn_agent');
            expect(tools).not.toContain('speak_to_agent');
            expect(tools).not.toContain('get_agents');
            expect(tools).toContain('read_file'); // original tool
        });

        it('should not add excluded agentic tools', () => {
            const tools = SystemMessages.getIncludedTools('test_agentic_excluded');
            expect(tools).not.toContain('spawn_agent'); // explicitly excluded
            expect(tools).toContain('speak_to_agent'); // not excluded
            expect(tools).toContain('get_agents'); // not excluded
            expect(tools).toContain('read_file'); // original tool
        });

        it('should not duplicate manually included agentic tools', () => {
            const tools = SystemMessages.getIncludedTools('test_agentic_manual');
            const spawnAgentCount = tools.filter(tool => tool === 'spawn_agent').length;
            const speakToAgentCount = tools.filter(tool => tool === 'speak_to_agent').length;

            expect(spawnAgentCount).toBe(1);
            expect(speakToAgentCount).toBe(1);
            expect(tools).toContain('get_agents'); // should be added automatically
        });
    });

    describe('Automatic Task Tools', () => {
        it('should add task tools when can_create_tasks_for is non-empty array', () => {
            const tools = SystemMessages.getIncludedTools('test_task_tools');
            expect(tools).toContain('list_tasks');
            expect(tools).toContain('edit_tasks');
            expect(tools).toContain('get_task');
            expect(tools).toContain('read_file'); // original tool
        });

        it('should not add task tools when can_create_tasks_for is empty array', () => {
            const tools = SystemMessages.getIncludedTools('test_empty_tasks');
            expect(tools).not.toContain('list_tasks');
            expect(tools).not.toContain('edit_tasks');
            expect(tools).not.toContain('get_task');
            expect(tools).toContain('read_file'); // original tool
        });

        it('should not add task tools when can_create_tasks_for is not present', () => {
            const tools = SystemMessages.getIncludedTools('test_none');
            expect(tools).not.toContain('list_tasks');
            expect(tools).not.toContain('edit_tasks');
            expect(tools).not.toContain('get_task');
            expect(tools).toContain('read_file'); // original tool
        });

        it('should not add excluded task tools', () => {
            const tools = SystemMessages.getIncludedTools('test_task_excluded');
            expect(tools).not.toContain('list_tasks'); // explicitly excluded
            expect(tools).toContain('edit_tasks'); // not excluded
            expect(tools).toContain('get_task'); // not excluded
            expect(tools).toContain('read_file'); // original tool
        });
    });

    describe('Combined Agentic and Task Tools', () => {
        it('should add both agentic and task tools when both capabilities are present', () => {
            const tools = SystemMessages.getIncludedTools('test_both');

            // Agentic tools
            expect(tools).toContain('spawn_agent');
            expect(tools).toContain('speak_to_agent');
            expect(tools).toContain('get_agents');

            // Task tools
            expect(tools).toContain('list_tasks');
            expect(tools).toContain('edit_tasks');
            expect(tools).toContain('get_task');

            // Original tool
            expect(tools).toContain('read_file');
        });
    });

    describe('getCanCreateTasksFor method', () => {
        it('should return can_create_tasks_for array when present', () => {
            const roles = SystemMessages.getCanCreateTasksFor('test_task_tools');
            expect(roles).toEqual(['developer']);
        });

        it('should return empty array when can_create_tasks_for not present', () => {
            const roles = SystemMessages.getCanCreateTasksFor('test_none');
            expect(roles).toEqual([]);
        });

        it('should throw error for unknown role', () => {
            expect(() => {
                SystemMessages.getCanCreateTasksFor('unknown_role');
            }).toThrow('Unknown role: unknown_role');
        });
    });
});
