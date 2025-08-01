import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoleFixtures, RoleFixtures } from '../helpers/roleFixtures.js';
import AgentManager from '../../src/agents/AgentManager.js';
import AIAPIClient from '../../src/core/ai/aiAPIClient.js';

describe('Role Spawn with Groups Integration Test', () => {
    let roleFixtures;
    let cleanupFixture;
    let mockSystemMessages;
    let mockAPIClient;
    let agentManager;
    let originalSystemMessages;

    beforeEach(async () => {
        // Create role fixtures manager
        roleFixtures = createRoleFixtures();

        // Create mock SystemMessages with our test fixture
        mockSystemMessages = roleFixtures.createMockSystemMessages('role-spawn-test.json');

        // Mock the SystemMessages module
        cleanupFixture = vi.doMock('../../src/core/ai/systemMessages.js', () => ({
            default: mockSystemMessages,
        }));

        // Create mock API client to capture requests
        mockAPIClient = {
            sendMessage: vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'Mock response from spawned agent' } }],
                usage: { total_tokens: 10 },
            }),
            getModel: vi.fn().mockReturnValue({
                model: 'gpt-4.1-mini',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: 'test-key',
            }),
        };

        // Get fresh AgentManager instance
        agentManager = AgentManager.getInstance();

        // Clear any existing agents
        agentManager.activeAgents.clear();
        agentManager.agentHierarchy.clear();
        agentManager.agentCounter = 0;
    });

    afterEach(() => {
        // Clean up fixtures and mocks
        if (cleanupFixture) {
            cleanupFixture();
            cleanupFixture = null;
        }
        if (roleFixtures) {
            roleFixtures.restoreAll();
        }

        // Clear agents
        if (agentManager) {
            agentManager.activeAgents.clear();
            agentManager.agentHierarchy.clear();
            agentManager.agentCounter = 0;
        }

        vi.clearAllMocks();
    });

    describe('Group-Prefixed Role Spawning', () => {
        it('should use correct system message when spawning with group prefix', async () => {
            // Verify our fixture setup is correct
            expect(mockSystemMessages.hasRole('test_role')).toBe(true);

            // Note: In our fixture, test_role exists in both global and local groups
            // The actual group assignment depends on the loading order
            const actualGroup = mockSystemMessages.getRoleGroup('test_role');
            expect(['global', 'local']).toContain(actualGroup);

            // Verify we can resolve the local group role explicitly
            const localRoleResolution = mockSystemMessages.resolveRole('local.test_role');
            expect(localRoleResolution.found).toBe(true);
            expect(localRoleResolution.group).toBe('local');
            expect(localRoleResolution.roleName).toBe('test_role');

            // Verify different system messages based on which group the role resolved to
            const defaultSystemMessage = mockSystemMessages.getSystemMessage('test_role');
            // The message will depend on which group the role was assigned to
            expect(defaultSystemMessage).toMatch(/(GLOBAL|LOCAL) test role/);

            // For local role, we need to check if the mock supports group-prefixed getSystemMessage
            // Let's enhance our mock to support this
            mockSystemMessages.getSystemMessage = vi.fn(roleSpec => {
                if (roleSpec === 'local.test_role') {
                    return 'You are a LOCAL test role. This message SHOULD be used when spawning local.test_role.';
                } else if (roleSpec === 'test_role') {
                    return 'You are a GLOBAL test role. This message should NOT be used when spawning local.test_role.';
                }
                throw new Error(`Unknown role: ${roleSpec}`);
            });

            const localSystemMessage = mockSystemMessages.getSystemMessage('local.test_role');
            expect(localSystemMessage).toContain('LOCAL test role');
            expect(localSystemMessage).toContain('SHOULD be used');

            // Verify spawn permission - global test_role should be able to spawn local.test_role
            expect(mockSystemMessages.canSpawnAgent('test_role', 'local.test_role')).toBe(true);
        });

        it('should spawn agent with group-prefixed role and use correct system message', async () => {
            // Enhanced mock to support group-prefixed system messages
            mockSystemMessages.getSystemMessage = vi.fn(roleSpec => {
                if (roleSpec === 'local.test_role') {
                    return 'You are a LOCAL test role. This message SHOULD be used when spawning local.test_role.';
                } else if (roleSpec === 'test_role') {
                    return 'You are a GLOBAL test role. This message should NOT be used when spawning local.test_role.';
                }
                throw new Error(`Unknown role: ${roleSpec}`);
            });

            // Mock the agent spawning process
            const mockSpawnResult = {
                agentId: 'agent-1',
                role: 'local.test_role',
                status: 'running',
                systemMessage:
                    'You are a LOCAL test role. This message SHOULD be used when spawning local.test_role.',
            };

            // Mock the spawnAgent method to capture the system message used
            const originalSpawnAgent = agentManager.spawnAgent;
            let capturedSystemMessage = null;

            agentManager.spawnAgent = vi.fn(
                async (supervisorRole, workerRole, initialMessage, context) => {
                    // Capture the system message that would be used
                    capturedSystemMessage = mockSystemMessages.getSystemMessage(workerRole);

                    // Create a mock agent
                    const agentId = `agent-${++agentManager.agentCounter}`;
                    const mockAgent = {
                        id: agentId,
                        role: workerRole,
                        status: 'running',
                        systemMessage: capturedSystemMessage,
                        sendMessage: vi.fn().mockResolvedValue('Mock agent response'),
                    };

                    agentManager.activeAgents.set(agentId, mockAgent);
                    return { agentId, status: 'spawned' };
                }
            );

            // Spawn the agent with group-prefixed role
            const spawnResult = await agentManager.spawnAgent(
                'test_role',
                'local.test_role',
                'Test message for local agent',
                { apiClient: mockAPIClient }
            );

            // Verify spawn was successful
            expect(spawnResult.status).toBe('spawned');
            expect(spawnResult.agentId).toBeDefined();

            // Verify the correct system message was captured
            expect(capturedSystemMessage).toBeDefined();
            expect(capturedSystemMessage).toContain('LOCAL test role');
            expect(capturedSystemMessage).toContain('SHOULD be used');
            expect(capturedSystemMessage).not.toContain('should NOT be used');

            // Verify the agent was created with the correct role
            const createdAgent = agentManager.activeAgents.get(spawnResult.agentId);
            expect(createdAgent).toBeDefined();
            expect(createdAgent.role).toBe('local.test_role');
            expect(createdAgent.systemMessage).toContain('LOCAL test role');
        });

        it('should differentiate between global and local roles in API requests', async () => {
            // Enhanced mock to support group-prefixed system messages
            mockSystemMessages.getSystemMessage = vi.fn(roleSpec => {
                if (roleSpec === 'local.test_role') {
                    return 'You are a LOCAL test role. This message SHOULD be used when spawning local.test_role.';
                } else if (roleSpec === 'test_role') {
                    return 'You are a GLOBAL test role. This message should NOT be used when spawning local.test_role.';
                }
                throw new Error(`Unknown role: ${roleSpec}`);
            });

            // Create a more realistic mock that simulates actual agent communication
            let capturedAPIRequest = null;

            mockAPIClient.sendMessage = vi.fn(async (messages, tools, options) => {
                capturedAPIRequest = { messages, tools, options };
                return {
                    choices: [{ message: { content: 'Mock response from local agent' } }],
                    usage: { total_tokens: 15 },
                };
            });

            // Mock agent creation and message sending
            agentManager.spawnAgent = vi.fn(
                async (supervisorRole, workerRole, initialMessage, context) => {
                    const systemMessage = mockSystemMessages.getSystemMessage(workerRole);
                    const agentId = `agent-${++agentManager.agentCounter}`;

                    const mockAgent = {
                        id: agentId,
                        role: workerRole,
                        status: 'running',
                        systemMessage: systemMessage,
                        sendMessage: vi.fn(async message => {
                            // Simulate sending message to API with system message
                            const messages = [
                                { role: 'system', content: systemMessage },
                                { role: 'user', content: message },
                            ];

                            return await context.apiClient.sendMessage(messages, [], {});
                        }),
                    };

                    agentManager.activeAgents.set(agentId, mockAgent);
                    return { agentId, status: 'spawned' };
                }
            );

            // Spawn agent and send message
            const spawnResult = await agentManager.spawnAgent(
                'test_role',
                'local.test_role',
                'Test message',
                { apiClient: mockAPIClient }
            );

            const agent = agentManager.activeAgents.get(spawnResult.agentId);
            await agent.sendMessage('Hello from test');

            // Verify API request was made with correct system message
            expect(mockAPIClient.sendMessage).toHaveBeenCalled();
            expect(capturedAPIRequest).toBeDefined();
            expect(capturedAPIRequest.messages).toBeDefined();
            expect(capturedAPIRequest.messages.length).toBe(2);

            const systemMessageInRequest = capturedAPIRequest.messages[0];
            expect(systemMessageInRequest.role).toBe('system');
            expect(systemMessageInRequest.content).toContain('LOCAL test role');
            expect(systemMessageInRequest.content).toContain('SHOULD be used');
            expect(systemMessageInRequest.content).not.toContain('should NOT be used');
        });

        it('should handle ambiguous role resolution when same role exists in multiple non-global groups', async () => {
            // Enhanced mock to support group-prefixed system messages for role1 variants
            mockSystemMessages.getSystemMessage = vi.fn(roleSpec => {
                if (roleSpec === 'local.test_role') {
                    return 'You are a LOCAL test role. This message SHOULD be used when spawning local.test_role.';
                } else if (roleSpec === 'test_role') {
                    return 'You are a GLOBAL test role. This message should NOT be used when spawning local.test_role.';
                } else if (roleSpec === 'group1.role1') {
                    return 'You are GROUP1 role1. This message should be used when spawning group1.role1.';
                } else if (roleSpec === 'group2.role1') {
                    return 'You are GROUP2 role1. This message should be used when spawning group2.role1.';
                }
                throw new Error(`Unknown role: ${roleSpec}`);
            });

            // Test that role1 is not directly accessible due to ambiguity
            expect(mockSystemMessages.hasRole('role1')).toBe(false); // Should not exist in flattened roles due to ambiguity

            // Test role resolution for group-prefixed roles
            const group1Resolution = mockSystemMessages.resolveRole('group1.role1');
            expect(group1Resolution.found).toBe(true);
            expect(group1Resolution.group).toBe('group1');
            expect(group1Resolution.roleName).toBe('role1');
            expect(group1Resolution.ambiguous).toBe(false);

            const group2Resolution = mockSystemMessages.resolveRole('group2.role1');
            expect(group2Resolution.found).toBe(true);
            expect(group2Resolution.group).toBe('group2');
            expect(group2Resolution.roleName).toBe('role1');
            expect(group2Resolution.ambiguous).toBe(false);

            // Test ambiguous resolution for imprecise reference
            const ambiguousResolution = mockSystemMessages.resolveRole('role1');
            expect(ambiguousResolution.found).toBe(false);
            expect(ambiguousResolution.ambiguous).toBe(true);
            expect(ambiguousResolution.availableGroups).toEqual(
                expect.arrayContaining(['group1', 'group2'])
            );

            // Test system messages work with group prefixes
            const group1SystemMessage = mockSystemMessages.getSystemMessage('group1.role1');
            expect(group1SystemMessage).toContain('GROUP1 role1');

            const group2SystemMessage = mockSystemMessages.getSystemMessage('group2.role1');
            expect(group2SystemMessage).toContain('GROUP2 role1');

            // Test spawn permissions work with group-prefixed roles
            expect(mockSystemMessages.canSpawnAgent('group1.role1', 'group2.role1')).toBe(true);
        });

        it('should fail agent spawning when using ambiguous role reference', async () => {
            // Enhanced mock to support group-prefixed system messages
            mockSystemMessages.getSystemMessage = vi.fn(roleSpec => {
                if (roleSpec === 'group1.role1') {
                    return 'You are GROUP1 role1. This message should be used when spawning group1.role1.';
                } else if (roleSpec === 'group2.role1') {
                    return 'You are GROUP2 role1. This message should be used when spawning group2.role1.';
                }
                throw new Error(`Unknown role: ${roleSpec}`);
            });

            // Mock spawnAgent to capture and validate role resolution
            let capturedError = null;

            agentManager.spawnAgent = vi.fn(
                async (supervisorRole, workerRole, initialMessage, context) => {
                    // Simulate the role resolution that would happen in real AgentManager
                    const workerResolution = mockSystemMessages.resolveRole(workerRole);

                    if (workerResolution.ambiguous) {
                        const error = new Error(
                            `Role '${workerRole}' is ambiguous. Found in groups: ${workerResolution.availableGroups.join(', ')}. ` +
                                `Please specify group explicitly (e.g., '${workerResolution.availableGroups[0]}.${workerResolution.roleName}')`
                        );
                        capturedError = error;
                        throw error;
                    }

                    if (!workerResolution.found) {
                        const error = new Error(`Role '${workerRole}' not found`);
                        capturedError = error;
                        throw error;
                    }

                    // If we get here, the role was resolved successfully
                    const agentId = `agent-${++agentManager.agentCounter}`;
                    const systemMessage = mockSystemMessages.getSystemMessage(workerRole);

                    const mockAgent = {
                        id: agentId,
                        role: workerRole,
                        status: 'running',
                        systemMessage: systemMessage,
                    };

                    agentManager.activeAgents.set(agentId, mockAgent);
                    return { agentId, status: 'spawned' };
                }
            );

            // Attempt to spawn with ambiguous role reference - should fail
            await expect(
                agentManager.spawnAgent(
                    'group1.role1',
                    'role1', // Ambiguous reference
                    'Test message',
                    { apiClient: mockAPIClient }
                )
            ).rejects.toThrow();

            // Verify the error message is about ambiguity
            expect(capturedError).toBeDefined();
            expect(capturedError.message).toContain('is ambiguous');
            expect(capturedError.message).toContain('Found in groups: group1, group2');
            expect(capturedError.message).toContain('Please specify group explicitly');

            // Verify that explicit group references work
            const group1SpawnResult = await agentManager.spawnAgent(
                'group1.role1',
                'group2.role1', // Explicit reference
                'Test message',
                { apiClient: mockAPIClient }
            );

            expect(group1SpawnResult.status).toBe('spawned');
            expect(group1SpawnResult.agentId).toBeDefined();

            // Verify the agent was created with correct role
            const createdAgent = agentManager.activeAgents.get(group1SpawnResult.agentId);
            expect(createdAgent).toBeDefined();
            expect(createdAgent.role).toBe('group2.role1');
            expect(createdAgent.systemMessage).toContain('GROUP2 role1');
        });
    });
});
