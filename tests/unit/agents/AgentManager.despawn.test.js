import { describe, it, expect, beforeEach, vi } from 'vitest';
import AgentManager from '../../../src/agents/AgentManager.js';

describe('AgentManager.despawnAgent', () => {
    let agentManager;
    let mockAgent1, mockAgent2, mockAgent3;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton
        AgentManager.instance = null;
        agentManager = new AgentManager();

        // Create mock agents
        mockAgent1 = {
            agentId: 'agent-1',
            roleName: 'pm',
            status: 'completed',
            parentId: null, // User-spawned
        };

        mockAgent2 = {
            agentId: 'agent-2',
            roleName: 'test_writer',
            status: 'completed',
            parentId: 'agent-1', // Spawned by agent-1
        };

        mockAgent3 = {
            agentId: 'agent-3',
            roleName: 'code_reviewer',
            status: 'running',
            parentId: 'agent-1', // Spawned by agent-1
        };

        // Set up agent tracking
        agentManager.activeAgents.set('agent-1', mockAgent1);
        agentManager.activeAgents.set('agent-2', mockAgent2);
        agentManager.activeAgents.set('agent-3', mockAgent3);

        // Set up hierarchy
        agentManager.agentHierarchy.set(null, new Set(['agent-1'])); // User -> agent-1
        agentManager.agentHierarchy.set('agent-1', new Set(['agent-2', 'agent-3'])); // agent-1 -> agent-2, agent-3
    });

    describe('successful despawn', () => {
        it('should despawn completed agent successfully', async () => {
            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);
            expect(result.agent_id).toBe('agent-2');
            expect(result.role_name).toBe('test_writer');
            expect(result.status).toBe('completed');
            expect(result.despawned_at).toBeDefined();
            expect(result.message).toContain('Successfully despawned');

            // Verify agent was removed from activeAgents
            expect(agentManager.activeAgents.has('agent-2')).toBe(false);

            // Verify agent was removed from parent's hierarchy
            const parentChildren = agentManager.agentHierarchy.get('agent-1');
            expect(parentChildren.has('agent-2')).toBe(false);
            expect(parentChildren.has('agent-3')).toBe(true); // Other child should remain
        });

        it('should despawn failed agent successfully', async () => {
            mockAgent2.status = 'failed';

            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);
            expect(result.status).toBe('failed');
        });

        it('should despawn inactive agent successfully', async () => {
            mockAgent2.status = 'inactive';

            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);
            expect(result.status).toBe('inactive');
        });

        it('should handle user despawning root agent', async () => {
            mockAgent1.status = 'completed';
            // Make sure agent-1 has no active children by completing agent-3
            mockAgent3.status = 'completed';

            const result = await agentManager.despawnAgent(null, 'agent-1');

            expect(result.success).toBe(true);
            expect(result.agent_id).toBe('agent-1');

            // Verify agent was removed
            expect(agentManager.activeAgents.has('agent-1')).toBe(false);

            // Verify hierarchy cleanup - user hierarchy entry should be completely removed
            const userChildren = agentManager.agentHierarchy.get(null);
            expect(userChildren).toBeUndefined(); // Entry should be completely removed when empty
        });

        it('should clean up empty hierarchy entries', async () => {
            // Remove agent-3 first so agent-1 has only one child
            agentManager.activeAgents.delete('agent-3');
            agentManager.agentHierarchy.get('agent-1').delete('agent-3');

            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);

            // Parent hierarchy entry should be removed when empty
            expect(agentManager.agentHierarchy.has('agent-1')).toBe(false);
        });
    });

    describe('validation errors', () => {
        it('should throw error for non-existent agent', async () => {
            await expect(agentManager.despawnAgent('agent-1', 'non-existent')).rejects.toThrow(
                'Agent non-existent not found'
            );
        });

        it('should throw error for wrong parent', async () => {
            await expect(
                agentManager.despawnAgent('agent-2', 'agent-3') // agent-2 is not parent of agent-3
            ).rejects.toThrow(
                'Permission denied: Agent agent-2 is not the parent of agent agent-3'
            );
        });

        it('should throw error for user trying to despawn non-child agent', async () => {
            await expect(
                agentManager.despawnAgent(null, 'agent-2') // User is not parent of agent-2
            ).rejects.toThrow('Permission denied: Agent user is not the parent of agent agent-2');
        });
    });

    describe('status validation', () => {
        it('should throw error for running agent', async () => {
            mockAgent2.status = 'running';

            await expect(agentManager.despawnAgent('agent-1', 'agent-2')).rejects.toThrow(
                "Cannot despawn agent agent-2 with status 'running'"
            );
        });
    });

    describe('active children validation', () => {
        it('should throw error when agent has running children', async () => {
            // Add a child to agent-2
            const mockAgent4 = {
                agentId: 'agent-4',
                roleName: 'developer',
                status: 'running',
                parentId: 'agent-2',
            };
            agentManager.activeAgents.set('agent-4', mockAgent4);
            agentManager.agentHierarchy.set('agent-2', new Set(['agent-4']));

            await expect(agentManager.despawnAgent('agent-1', 'agent-2')).rejects.toThrow(
                'Cannot despawn agent agent-2 because it has active children: agent-4'
            );
        });

        it('should allow despawn when agent has only inactive children', async () => {
            // Add an inactive child to agent-2
            const mockAgent4 = {
                agentId: 'agent-4',
                roleName: 'developer',
                status: 'inactive',
                parentId: 'agent-2',
            };
            agentManager.activeAgents.set('agent-4', mockAgent4);
            agentManager.agentHierarchy.set('agent-2', new Set(['agent-4']));

            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);
        });

        it('should allow despawn when all children are completed, failed, or inactive', async () => {
            // Add completed, failed, and inactive children to agent-2
            const mockAgent4 = {
                agentId: 'agent-4',
                roleName: 'developer',
                status: 'completed',
                parentId: 'agent-2',
            };
            const mockAgent5 = {
                agentId: 'agent-5',
                roleName: 'tester',
                status: 'failed',
                parentId: 'agent-2',
            };
            const mockAgent6 = {
                agentId: 'agent-6',
                roleName: 'reviewer',
                status: 'inactive',
                parentId: 'agent-2',
            };
            agentManager.activeAgents.set('agent-4', mockAgent4);
            agentManager.activeAgents.set('agent-5', mockAgent5);
            agentManager.activeAgents.set('agent-6', mockAgent6);
            agentManager.agentHierarchy.set('agent-2', new Set(['agent-4', 'agent-5', 'agent-6']));

            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);
        });

        it('should handle multiple active children in error message', async () => {
            // Add multiple running children to agent-2 (only running children are considered active)
            const mockAgent4 = {
                agentId: 'agent-4',
                roleName: 'developer',
                status: 'running',
                parentId: 'agent-2',
            };
            const mockAgent5 = {
                agentId: 'agent-5',
                roleName: 'tester',
                status: 'running',
                parentId: 'agent-2',
            };
            agentManager.activeAgents.set('agent-4', mockAgent4);
            agentManager.activeAgents.set('agent-5', mockAgent5);
            agentManager.agentHierarchy.set('agent-2', new Set(['agent-4', 'agent-5']));

            await expect(agentManager.despawnAgent('agent-1', 'agent-2')).rejects.toThrow(
                'Cannot despawn agent agent-2 because it has active children: agent-4, agent-5'
            );
        });
    });

    describe('hierarchy cleanup', () => {
        it('should remove agent from hierarchy maps', async () => {
            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);

            // Agent should be removed from parent's children
            const parentChildren = agentManager.agentHierarchy.get('agent-1');
            expect(parentChildren.has('agent-2')).toBe(false);

            // Agent's own hierarchy entry should be removed
            expect(agentManager.agentHierarchy.has('agent-2')).toBe(false);
        });

        it('should not remove parent hierarchy entry if other children exist', async () => {
            const result = await agentManager.despawnAgent('agent-1', 'agent-2');

            expect(result.success).toBe(true);

            // Parent should still have hierarchy entry because agent-3 exists
            expect(agentManager.agentHierarchy.has('agent-1')).toBe(true);
            const parentChildren = agentManager.agentHierarchy.get('agent-1');
            expect(parentChildren.has('agent-3')).toBe(true);
        });
    });
});
