import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConfigManager from '../../src/config/managers/configManager.js';
import AgentManager from '../../src/agents/AgentManager.js';
import ToolManager from '../../src/core/managers/toolManager.js';
import SystemMessages from '../../src/core/ai/systemMessages.js';
import { initializeLogger } from '../../src/core/managers/logger.js';

/**
 * End-to-End Test for Agent Spawning Workflow
 *
 * This test validates the complete agent spawning process from tool call
 * through to successful agent initialization and basic communication.
 * It should catch issues like:
 * - Configuration problems
 * - Missing methods on AIAPIClient
 * - Context propagation issues
 * - Agent initialization failures
 * - Tool execution problems
 */
describe('Agent Spawning E2E', () => {
    let configManager;
    let agentManager;
    let toolManager;
    let mockCostsManager;
    let mockConsoleInterface;
    let originalCanSpawnAgent;

    beforeEach(async () => {
        // Initialize logger
        initializeLogger({ global: { verbosity: 1 } });

        // Reset singletons
        ConfigManager.instance = null;
        AgentManager.instance = null;

        // Initialize ConfigManager with test configuration
        configManager = ConfigManager.getInstance({
            apiKey: 'test-api-key-e2e',
            baseModel: 'gpt-4.1-mini',
            baseUrl: 'https://api.openai.com/v1',
        });
        await configManager.initialize();

        // Initialize AgentManager
        agentManager = AgentManager.getInstance();

        // Initialize ToolManager
        toolManager = new ToolManager();
        await toolManager.loadTools();

        // Create mock costs manager
        mockCostsManager = {
            trackCost: vi.fn(),
            getCosts: vi.fn(() => ({ total: 0 })),
            addCost: vi.fn(),
        };

        // Create mock console interface
        mockConsoleInterface = {
            showToolExecution: vi.fn(),
            showToolResult: vi.fn(),
            showToolCancelled: vi.fn(),
            promptForConfirmation: vi.fn(() => Promise.resolve(true)),
        };

        // Mock SystemMessages to allow agent spawning
        originalCanSpawnAgent = SystemMessages.canSpawnAgent;
        SystemMessages.canSpawnAgent = vi.fn(() => true);
    });

    afterEach(() => {
        // Restore original methods
        SystemMessages.canSpawnAgent = originalCanSpawnAgent;

        // Reset AgentManager
        agentManager.reset();

        // Clear all mocks
        vi.clearAllMocks();
    });

    describe('Complete Agent Spawning Workflow', () => {
        it('should successfully spawn an agent through the tool system', async () => {
            // Create execution context similar to real application
            const executionContext = {
                currentRole: 'pm',
                currentAgentId: null,
                agentManager: agentManager,
                costsManager: mockCostsManager,
                toolManager: toolManager,
            };

            // Test 1: Verify spawn_agent tool exists and is loaded
            const spawnAgentTool = toolManager.getToolDefinition('spawn_agent');
            expect(spawnAgentTool).toBeDefined();
            expect(spawnAgentTool.name).toBe('spawn_agent');

            // Test 2: Execute spawn_agent tool with proper parameters
            const toolCall = {
                type: 'function',
                function: {
                    name: 'spawn_agent',
                    arguments: JSON.stringify({
                        role_name: 'architect',
                        task_prompt:
                            'Design a comprehensive system architecture for a new web application',
                    }),
                },
            };

            console.log('🧪 E2E Test: Executing spawn_agent tool...');

            // This should complete without throwing errors
            const result = await toolManager.executeToolCall(
                toolCall,
                mockConsoleInterface,
                null, // snapshotManager
                executionContext
            );

            console.log('🔍 E2E Test: Tool execution result:', result);

            // Test 3: Verify tool execution result
            expect(result).toBeDefined();

            // Parse the actual result from the tool response
            const parsedResult = result.content ? JSON.parse(result.content) : result;
            console.log('🔍 E2E Test: Parsed result:', parsedResult);

            expect(parsedResult.success).toBe(true);
            expect(parsedResult.agent_id).toBeDefined();
            expect(parsedResult.role_name).toBe('architect');
            expect(parsedResult.timestamp).toBeDefined();

            console.log('✅ E2E Test: Agent spawned successfully:', {
                agent_id: parsedResult.agent_id,
                role_name: parsedResult.role_name,
            });

            // Test 4: Verify agent was registered in AgentManager
            const agents = agentManager.listAgents(null); // null for main user
            expect(agents).toHaveLength(1);
            expect(agents[0].agentId).toBe(parsedResult.agent_id);
            expect(agents[0].roleName).toBe('architect');
            expect(agents[0].status).toBe('running');

            // Test 5: Verify agent has proper initialization
            const spawnedAgent = agentManager.activeAgents.get(parsedResult.agent_id);
            expect(spawnedAgent).toBeDefined();
            expect(spawnedAgent.apiClient).toBeDefined();
            expect(spawnedAgent.taskPrompt).toBe(
                'Design a comprehensive system architecture for a new web application'
            );
            expect(spawnedAgent.createdAt).toBeInstanceOf(Date);

            // Test 6: Verify agent can receive messages (tests addMessage method)
            expect(() => {
                spawnedAgent.addMessage({
                    role: 'user',
                    content: 'Test message to verify addMessage works',
                });
            }).not.toThrow();

            // Test 7: Verify agent status can be retrieved
            const agentStatus = spawnedAgent.getStatus();
            expect(agentStatus).toBeDefined();
            expect(agentStatus.agentId).toBe(parsedResult.agent_id);
            expect(agentStatus.status).toBe('running');
            expect(agentStatus.roleName).toBe('architect');

            console.log('✅ E2E Test: All agent functionality verified');
        });

        it('should handle agent spawning errors gracefully', async () => {
            // Test error handling with invalid role
            const executionContext = {
                currentRole: 'pm',
                currentAgentId: null,
                agentManager: agentManager,
                costsManager: mockCostsManager,
                toolManager: toolManager,
            };

            const toolCall = {
                type: 'function',
                function: {
                    name: 'spawn_agent',
                    arguments: JSON.stringify({
                        role_name: 'nonexistent_role',
                        task_prompt: 'Test task',
                    }),
                },
            };

            const result = await toolManager.executeToolCall(
                toolCall,
                mockConsoleInterface,
                null,
                executionContext
            );

            // Should return error result, not throw exception
            expect(result).toBeDefined();

            // Parse the result if it's in content format
            const parsedResult = result.content ? JSON.parse(result.content) : result;

            expect(parsedResult.success).toBe(false);
            expect(parsedResult.error).toBeDefined();
            expect(typeof parsedResult.error).toBe('string');
        });

        it('should validate agent communication workflow', async () => {
            // First spawn an agent
            const executionContext = {
                currentRole: 'pm',
                currentAgentId: null,
                agentManager: agentManager,
                costsManager: mockCostsManager,
                toolManager: toolManager,
            };

            const spawnResult = await toolManager.executeToolCall(
                {
                    type: 'function',
                    function: {
                        name: 'spawn_agent',
                        arguments: JSON.stringify({
                            role_name: 'architect',
                            task_prompt: 'Design system architecture',
                        }),
                    },
                },
                mockConsoleInterface,
                null,
                executionContext
            );

            const parsedSpawnResult = spawnResult.content ? JSON.parse(spawnResult.content) : spawnResult;
            expect(parsedSpawnResult.success).toBe(true);

            // Test get_agents tool
            const getAgentsResult = await toolManager.executeToolCall(
                {
                    type: 'function',
                    function: {
                        name: 'get_agents',
                        arguments: JSON.stringify({}),
                    },
                },
                mockConsoleInterface,
                null,
                executionContext
            );

            const parsedGetAgentsResult = getAgentsResult.content ? JSON.parse(getAgentsResult.content) : getAgentsResult;
            expect(parsedGetAgentsResult.success).toBe(true);
            expect(parsedGetAgentsResult.agents).toHaveLength(1);
            expect(parsedGetAgentsResult.agents[0].agent_id).toBe(parsedSpawnResult.agent_id);

            console.log('✅ E2E Test: Complete agent workflow validated');
        });
    });
});
