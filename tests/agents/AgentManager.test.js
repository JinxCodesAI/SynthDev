import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AgentManager from '../../src/agents/AgentManager.js';
import SystemMessages from '../../src/core/ai/systemMessages.js';

// Mock dependencies
vi.mock('../../src/core/ai/systemMessages.js');
vi.mock('../../src/agents/AgentProcess.js');

describe('AgentManager', () => {
    let agentManager;
    let mockSystemMessages;
    let mockContext;

    beforeEach(() => {
        // Reset singleton
        AgentManager.instance = null;
        agentManager = new AgentManager();

        mockSystemMessages = SystemMessages;
        mockContext = {
            costsManager: { trackCost: vi.fn() },
            toolManager: { getTools: vi.fn() },
        };
    });

    afterEach(() => {
        // Clean up singleton instance
        if (agentManager) {
            agentManager.reset();
        }
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = AgentManager.getInstance();
            const instance2 = AgentManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should initialize with empty collections', () => {
            expect(agentManager.activeAgents.size).toBe(0);
            expect(agentManager.agentHierarchy.size).toBe(0);
        });
    });

    describe('spawnAgent', () => {
        it.skip('should spawn agent with valid permissions', async () => {
            // Skip this test as it requires full AgentProcess mocking
            // Integration tests will cover this functionality
        });

        it('should reject spawning without permission', async () => {
            mockSystemMessages.canSpawnAgent.mockReturnValue(false);

            await expect(
                agentManager.spawnAgent('basic_role', 'test_writer', 'Write tests', mockContext)
            ).rejects.toThrow('not authorized');
        });

        it.skip('should track agent hierarchy', async () => {
            // Skip - integration tests will cover this
        });

        it.skip('should register agent in active agents', async () => {
            // Skip - integration tests will cover this
        });
    });

    describe('sendMessageToAgent', () => {
        let mockAgent;

        beforeEach(async () => {
            mockSystemMessages.canSpawnAgent.mockReturnValue(true);

            // Create a mock agent first
            mockAgent = {
                agentId: 'test-agent-id',
                status: 'inactive', // Agent can receive messages
                addMessage: vi.fn(),
                execute: vi.fn().mockResolvedValue('Mock response'),
                markInactive: vi.fn(),
                markFailed: vi.fn(),
            };

            agentManager.activeAgents.set('test-agent-id', mockAgent);
        });

        it('should send message to existing agent', async () => {
            const response = await agentManager.sendMessageToAgent('test-agent-id', 'Test message');

            expect(mockAgent.addMessage).toHaveBeenCalledWith({
                role: 'user',
                content: 'Test message',
            });
            expect(response.message_sent).toBe(true);
            expect(response.agent_id).toBe('test-agent-id');
            expect(response.status).toBe('running');
            expect(response.message).toContain('Message has been sent');
        });

        it('should throw error for non-existent agent', async () => {
            await expect(
                agentManager.sendMessageToAgent('non-existent', 'Test message')
            ).rejects.toThrow('Agent non-existent not found');
        });
    });

    describe('getAgentStatus', () => {
        it('should return agent status for existing agent', () => {
            const mockAgent = {
                getStatus: vi.fn().mockReturnValue({ agentId: 'test', status: 'running' }),
            };

            agentManager.activeAgents.set('test-agent-id', mockAgent);

            const status = agentManager.getAgentStatus('test-agent-id');

            expect(status).toEqual({ agentId: 'test', status: 'running' });
            expect(mockAgent.getStatus).toHaveBeenCalled();
        });

        it('should return null for non-existent agent', () => {
            const status = agentManager.getAgentStatus('non-existent');
            expect(status).toBeNull();
        });
    });

    describe('listAgents', () => {
        beforeEach(() => {
            // Set up agent hierarchy
            agentManager.agentHierarchy.set('supervisor', new Set(['agent1', 'agent2']));

            // Set up mock agents
            const mockAgent1 = {
                getStatus: vi.fn().mockReturnValue({
                    agentId: 'agent1',
                    status: 'running',
                    roleName: 'test_writer',
                }),
            };
            const mockAgent2 = {
                getStatus: vi.fn().mockReturnValue({
                    agentId: 'agent2',
                    status: 'completed',
                    roleName: 'code_reviewer',
                }),
            };

            agentManager.activeAgents.set('agent1', mockAgent1);
            agentManager.activeAgents.set('agent2', mockAgent2);
        });

        it('should return all agents for supervisor', () => {
            const agents = agentManager.listAgents('supervisor');

            expect(agents).toHaveLength(2);
            expect(agents[0].agentId).toBe('agent1');
            expect(agents[1].agentId).toBe('agent2');
        });

        it('should filter out completed agents when requested', () => {
            const agents = agentManager.listAgents('supervisor', { include_completed: false });

            expect(agents).toHaveLength(1);
            expect(agents[0].agentId).toBe('agent1');
            expect(agents[0].status).toBe('running');
        });

        it('should return empty array for supervisor with no agents', () => {
            const agents = agentManager.listAgents('unknown-supervisor');
            expect(agents).toHaveLength(0);
        });
    });

    describe('reportResult', () => {
        let mockAgent;

        beforeEach(() => {
            mockAgent = {
                markCompleted: vi.fn(),
            };
            agentManager.activeAgents.set('worker-id', mockAgent);
        });

        it('should mark agent as completed with result', async () => {
            const result = {
                status: 'success',
                summary: 'Task completed successfully',
                artifacts: [],
                known_issues: [],
            };

            await agentManager.reportResult('worker-id', result);

            expect(mockAgent.markCompleted).toHaveBeenCalledWith(result);
        });

        it('should throw error for non-existent worker', async () => {
            const result = { status: 'success', summary: 'Test' };

            await expect(agentManager.reportResult('non-existent', result)).rejects.toThrow(
                'Worker agent non-existent not found'
            );
        });
    });

    describe('_validateSpawnPermission', () => {
        it('should return true for valid permission', () => {
            mockSystemMessages.canSpawnAgent.mockReturnValue(true);

            const result = agentManager._validateSpawnPermission('agentic_coder', 'test_writer');

            expect(result).toBe(true);
            expect(mockSystemMessages.canSpawnAgent).toHaveBeenCalledWith(
                'agentic_coder',
                'test_writer'
            );
        });

        it('should return false for invalid permission', () => {
            mockSystemMessages.canSpawnAgent.mockReturnValue(false);

            const result = agentManager._validateSpawnPermission('basic_role', 'test_writer');

            expect(result).toBe(false);
        });

        it('should handle SystemMessages errors gracefully', () => {
            mockSystemMessages.canSpawnAgent.mockImplementation(() => {
                throw new Error('Role not found');
            });

            const result = agentManager._validateSpawnPermission('unknown_role', 'test_writer');

            expect(result).toBe(false);
        });
    });

    describe('reset', () => {
        it('should clear all agent data and reset singleton', () => {
            // Add some test data
            agentManager.activeAgents.set('test', {});
            agentManager.agentHierarchy.set('parent', new Set(['child']));

            agentManager.reset();

            expect(agentManager.activeAgents.size).toBe(0);
            expect(agentManager.agentHierarchy.size).toBe(0);
            expect(AgentManager.instance).toBeNull();
        });
    });

    describe('max tool calls callback', () => {
        it('should store callback when set', () => {
            const mockCallback = vi.fn().mockResolvedValue(true);

            agentManager.setMaxToolCallsExceededCallback(mockCallback);

            expect(agentManager.onMaxToolCallsExceeded).toBe(mockCallback);
        });

        it('should initialize with null callback', () => {
            expect(agentManager.onMaxToolCallsExceeded).toBeNull();
        });
    });
});
