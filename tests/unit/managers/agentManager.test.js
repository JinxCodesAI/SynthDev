import { describe, it, expect, beforeEach, vi } from 'vitest';
import AgentManager from '../../../src/core/managers/agentManager.js';

// Mock dependencies
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    })),
}));

vi.mock('../../../src/workflow/WorkflowAgent.js', () => ({
    default: vi
        .fn()
        .mockImplementation(
            (agentConfig, context, config, toolManager, snapshotManager, costsManager) => ({
                id: `mock-agent-${Date.now()}`,
                agentRole: agentConfig.agent_role,
                context: context,
                initialized: false,
                sendMessage: vi.fn().mockResolvedValue('Mock agent response'),
                getLastRawResponse: vi.fn(),
                getToolCalls: vi.fn().mockReturnValue([]),
                getParsingToolCalls: vi.fn().mockReturnValue([]),
            })
        ),
}));

vi.mock('../../../src/workflow/WorkflowContext.js', () => ({
    default: vi.fn().mockImplementation(contextConfig => ({
        name: contextConfig.name,
        addAgent: vi.fn(),
        removeAgent: vi.fn(),
    })),
}));

vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        hasRole: vi.fn().mockReturnValue(true),
    },
}));

describe('AgentManager', () => {
    let agentManager;
    let mockConfig;
    let mockToolManager;
    let mockSnapshotManager;
    let mockCostsManager;

    beforeEach(() => {
        mockConfig = {
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseUrl: 'test-url',
                model: 'test-model',
            }),
        };

        mockToolManager = {
            getTools: vi.fn().mockReturnValue([]),
        };

        mockSnapshotManager = {};

        mockCostsManager = {
            sessionId: 'test-session',
        };

        agentManager = new AgentManager(
            mockConfig,
            mockToolManager,
            mockSnapshotManager,
            mockCostsManager
        );
    });

    describe('spawnAgent', () => {
        it('should successfully spawn an agent with valid role', async () => {
            const result = await agentManager.spawnAgent('coder', 'parent-agent-1');

            expect(result.success).toBe(true);
            expect(result.agentId).toBeDefined();
            expect(result.agentRole).toBe('coder');
            expect(result.contextName).toBeDefined();
            expect(result.createdAt).toBeDefined();
        });

        it('should fail to spawn agent with invalid role', async () => {
            // Mock SystemMessages to return false for invalid role
            const SystemMessages = await import('../../../src/core/ai/systemMessages.js');
            SystemMessages.default.hasRole.mockReturnValueOnce(false);

            const result = await agentManager.spawnAgent('invalid-role', 'parent-agent-1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown agent role');
        });

        it('should track parent-child relationships', async () => {
            const parentId = 'parent-agent-1';
            const result = await agentManager.spawnAgent('coder', parentId);

            expect(result.success).toBe(true);

            const spawnedAgents = agentManager.getSpawnedAgents(parentId);
            expect(spawnedAgents).toHaveLength(1);
            expect(spawnedAgents[0].agentId).toBe(result.agentId);
            expect(spawnedAgents[0].agentRole).toBe('coder');
        });
    });

    describe('despawnAgent', () => {
        it('should successfully despawn an agent by its parent', async () => {
            const parentId = 'parent-agent-1';
            const spawnResult = await agentManager.spawnAgent('coder', parentId);
            const agentId = spawnResult.agentId;

            const despawnResult = await agentManager.despawnAgent(agentId, parentId);

            expect(despawnResult.success).toBe(true);
            expect(despawnResult.agentId).toBe(agentId);
            expect(despawnResult.agentRole).toBe('coder');
            expect(despawnResult.despawnedAt).toBeDefined();
        });

        it('should fail to despawn agent by non-parent', async () => {
            const parentId = 'parent-agent-1';
            const wrongParentId = 'wrong-parent';
            const spawnResult = await agentManager.spawnAgent('coder', parentId);
            const agentId = spawnResult.agentId;

            const despawnResult = await agentManager.despawnAgent(agentId, wrongParentId);

            expect(despawnResult.success).toBe(false);
            expect(despawnResult.error).toContain('Access denied');
        });

        it('should fail to despawn non-existent agent', async () => {
            const result = await agentManager.despawnAgent('non-existent-agent', 'parent-agent-1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should clean up parent-child relationships after despawn', async () => {
            const parentId = 'parent-agent-1';
            const spawnResult = await agentManager.spawnAgent('coder', parentId);
            const agentId = spawnResult.agentId;

            // Verify agent is tracked
            expect(agentManager.getSpawnedAgents(parentId)).toHaveLength(1);

            // Despawn agent
            await agentManager.despawnAgent(agentId, parentId);

            // Verify agent is no longer tracked
            expect(agentManager.getSpawnedAgents(parentId)).toHaveLength(0);
        });
    });

    describe('sendMessageToAgent', () => {
        it('should successfully send message to existing agent', async () => {
            const parentId = 'parent-agent-1';
            const spawnResult = await agentManager.spawnAgent('coder', parentId);
            const agentId = spawnResult.agentId;

            const result = await agentManager.sendMessageToAgent(agentId, 'Hello agent!');

            expect(result.success).toBe(true);
            expect(result.response).toBe('Mock agent response');
            expect(result.agentId).toBe(agentId);
        });

        it('should fail to send message to non-existent agent', async () => {
            const result = await agentManager.sendMessageToAgent('non-existent-agent', 'Hello!');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('getAgentInfo', () => {
        it('should return agent information for existing agent', async () => {
            const parentId = 'parent-agent-1';
            const spawnResult = await agentManager.spawnAgent('coder', parentId);
            const agentId = spawnResult.agentId;

            const info = agentManager.getAgentInfo(agentId);

            expect(info).toBeDefined();
            expect(info.agentId).toBe(agentId);
            expect(info.agentRole).toBe('coder');
            expect(info.parentAgentId).toBe(parentId);
            expect(info.status).toBe('active');
        });

        it('should return null for non-existent agent', () => {
            const info = agentManager.getAgentInfo('non-existent-agent');
            expect(info).toBeNull();
        });
    });

    describe('utility methods', () => {
        it('should track active agent count', async () => {
            expect(agentManager.getActiveAgentCount()).toBe(0);

            await agentManager.spawnAgent('coder', 'parent-1');
            expect(agentManager.getActiveAgentCount()).toBe(1);

            await agentManager.spawnAgent('reviewer', 'parent-1');
            expect(agentManager.getActiveAgentCount()).toBe(2);
        });

        it('should return all active agents', async () => {
            await agentManager.spawnAgent('coder', 'parent-1');
            await agentManager.spawnAgent('reviewer', 'parent-2');

            const allAgents = agentManager.getAllActiveAgents();
            expect(allAgents).toHaveLength(2);
            expect(allAgents.map(a => a.agentRole)).toContain('coder');
            expect(allAgents.map(a => a.agentRole)).toContain('reviewer');
        });
    });
});
