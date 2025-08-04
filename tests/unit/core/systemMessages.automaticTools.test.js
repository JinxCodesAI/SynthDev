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
                        includedTools: ['read_files'],
                    },
                    // Role with enabled_agents array (non-empty) - should get agentic tools
                    test_agentic_nonempty: {
                        enabled_agents: ['developer'],
                        includedTools: ['read_files'],
                    },
                    // Role with can_create_tasks_for array (non-empty) - should get task tools
                    test_task_tools: {
                        can_create_tasks_for: ['developer'],
                        includedTools: ['read_files'],
                    },
                    // Role with both agentic and task capabilities
                    test_both: {
                        enabled_agents: ['developer'],
                        can_create_tasks_for: ['developer'],
                        includedTools: ['read_files'],
                    },
                    // Role with no agentic or task capabilities
                    test_none: {
                        includedTools: ['read_files'],
                    },
                    // Role with enabled_agents but not array (should not get agentic tools)
                    test_not_array: {
                        enabled_agents: 'developer',
                        includedTools: ['read_files'],
                    },
                    // Role with empty can_create_tasks_for (should not get task tools)
                    test_empty_tasks: {
                        can_create_tasks_for: [],
                        includedTools: ['read_files'],
                    },
                    // Role with agentic tools explicitly excluded
                    test_agentic_excluded: {
                        enabled_agents: ['developer'],
                        includedTools: ['read_files'],
                        excludedTools: ['spawn_agent', 'despawn_agent'],
                    },
                    // Role with task tools explicitly excluded
                    test_task_excluded: {
                        can_create_tasks_for: ['developer'],
                        includedTools: ['read_files'],
                        excludedTools: ['list_tasks'],
                    },
                    // Role with agentic tools already included manually
                    test_agentic_manual: {
                        enabled_agents: ['developer'],
                        includedTools: [
                            'read_files',
                            'spawn_agent',
                            'despawn_agent',
                            'speak_to_agent',
                        ],
                    },
                    // Role for system message testing
                    test_system_message: {
                        systemMessage: 'Base system message.',
                        enabled_agents: ['developer', 'tester'],
                        can_create_tasks_for: ['developer'],
                        includedTools: ['read_files'],
                        agent_description: 'test role for system message enhancement',
                    },
                    // Developer role for system message testing
                    developer: {
                        systemMessage: 'Developer role.',
                        agent_description: 'responsible for implementing features',
                        includedTools: ['write_file'],
                    },
                    // Tester role for system message testing
                    tester: {
                        systemMessage: 'Tester role.',
                        agent_description: 'responsible for testing code',
                        includedTools: ['execute_tests'],
                    },
                    // Role without agent_description for testing missing descriptions
                    test_missing_description: {
                        systemMessage: 'Role without description.',
                        enabled_agents: ['no_description_role'],
                        includedTools: ['read_files'],
                    },
                    // Role without agent_description
                    no_description_role: {
                        systemMessage: 'Role without description.',
                        includedTools: ['write_file'],
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
            expect(tools).toContain('despawn_agent');
            expect(tools).toContain('speak_to_agent');
            expect(tools).toContain('get_agents');
            expect(tools).toContain('return_results');
            expect(tools).toContain('list_tasks');
            expect(tools).toContain('get_tasks');
            expect(tools).toContain('read_files'); // original tool
        });

        it('should add agentic tools when enabled_agents is non-empty array', () => {
            const tools = SystemMessages.getIncludedTools('test_agentic_nonempty');
            expect(tools).toContain('spawn_agent');
            expect(tools).toContain('despawn_agent');
            expect(tools).toContain('speak_to_agent');
            expect(tools).toContain('get_agents');
            expect(tools).toContain('return_results');
            expect(tools).toContain('list_tasks');
            expect(tools).toContain('get_tasks');
            expect(tools).toContain('read_files'); // original tool
        });

        it('should not add agentic tools when enabled_agents is not an array', () => {
            const tools = SystemMessages.getIncludedTools('test_not_array');
            expect(tools).not.toContain('spawn_agent');
            expect(tools).not.toContain('despawn_agent');
            expect(tools).not.toContain('speak_to_agent');
            expect(tools).not.toContain('get_agents');
            expect(tools).not.toContain('return_results');
            expect(tools).not.toContain('list_tasks');
            expect(tools).not.toContain('get_tasks');
            expect(tools).toContain('read_files'); // original tool
        });

        it('should not add agentic tools when enabled_agents is not present', () => {
            const tools = SystemMessages.getIncludedTools('test_none');
            expect(tools).not.toContain('spawn_agent');
            expect(tools).not.toContain('despawn_agent');
            expect(tools).not.toContain('speak_to_agent');
            expect(tools).not.toContain('get_agents');
            expect(tools).toContain('read_files'); // original tool
        });

        it('should not add excluded agentic tools', () => {
            const tools = SystemMessages.getIncludedTools('test_agentic_excluded');
            expect(tools).not.toContain('spawn_agent'); // explicitly excluded
            expect(tools).not.toContain('despawn_agent'); // explicitly excluded
            expect(tools).toContain('speak_to_agent'); // not excluded
            expect(tools).toContain('get_agents'); // not excluded
            expect(tools).toContain('read_files'); // original tool
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
            expect(tools).toContain('get_tasks');
            expect(tools).toContain('read_files'); // original tool
        });

        it('should not add task tools when can_create_tasks_for is empty array', () => {
            const tools = SystemMessages.getIncludedTools('test_empty_tasks');
            expect(tools).not.toContain('list_tasks');
            expect(tools).not.toContain('edit_tasks');
            expect(tools).not.toContain('get_tasks');
            expect(tools).toContain('read_files'); // original tool
        });

        it('should not add task tools when can_create_tasks_for is not present', () => {
            const tools = SystemMessages.getIncludedTools('test_none');
            expect(tools).not.toContain('list_tasks');
            expect(tools).not.toContain('edit_tasks');
            expect(tools).not.toContain('get_tasks');
            expect(tools).toContain('read_files'); // original tool
        });

        it('should not add excluded task tools', () => {
            const tools = SystemMessages.getIncludedTools('test_task_excluded');
            expect(tools).not.toContain('list_tasks'); // explicitly excluded
            expect(tools).toContain('edit_tasks'); // not excluded
            expect(tools).toContain('get_tasks'); // not excluded
            expect(tools).toContain('read_files'); // original tool
        });
    });

    describe('Combined Agentic and Task Tools', () => {
        it('should add both agentic and task tools when both capabilities are present', () => {
            const tools = SystemMessages.getIncludedTools('test_both');

            // Agentic tools
            expect(tools).toContain('spawn_agent');
            expect(tools).toContain('despawn_agent');
            expect(tools).toContain('speak_to_agent');
            expect(tools).toContain('get_agents');

            // Task tools
            expect(tools).toContain('list_tasks');
            expect(tools).toContain('edit_tasks');
            expect(tools).toContain('get_tasks');

            // Original tool
            expect(tools).toContain('read_files');
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

    describe('System Message Enhancement', () => {
        it('should append role coordination info when enabled_agents is present', () => {
            const systemMessage = SystemMessages.getSystemMessage('test_system_message');

            expect(systemMessage).toContain('Base system message.');
            expect(systemMessage).toContain(
                'Your role is test_system_message and you need to coordinate with other roles like: developer, tester'
            );
            expect(systemMessage).toContain('developer - responsible for implementing features');
            expect(systemMessage).toContain('tester - responsible for testing code');
            expect(systemMessage).toContain(
                'Use get_agents to understand what agents are already available'
            );
            expect(systemMessage).toContain('use spawn_agent to initialize new agent');
            expect(systemMessage).toContain('despawn_agent');
        });

        it('should append task creation info when can_create_tasks_for is present', () => {
            const systemMessage = SystemMessages.getSystemMessage('test_system_message');

            expect(systemMessage).toContain('Create tasks for developer if role is more suitable');
        });

        it('should append task management info when enabled_agents is present', () => {
            const systemMessage = SystemMessages.getSystemMessage('test_system_message');

            expect(systemMessage).toContain(
                'Use list_tasks, get_tasks to validate if there are any tasks you should start working on'
            );
        });

        it('should append return_results info when enabled_agents is present', () => {
            const systemMessage = SystemMessages.getSystemMessage('test_system_message');

            expect(systemMessage).toContain(
                'use return_results to give your supervisor detailed report'
            );
        });

        it('should not append coordination info when enabled_agents is empty', () => {
            const systemMessage = SystemMessages.getSystemMessage('test_none');

            expect(systemMessage).not.toContain('coordinate with other roles');
            expect(systemMessage).not.toContain('Use get_agents');
            expect(systemMessage).not.toContain('use return_results');
        });

        it('should handle missing agent descriptions gracefully', () => {
            const systemMessage = SystemMessages.getSystemMessage('test_missing_description');

            expect(systemMessage).toContain('no_description_role - No description available');
        });
    });
});
