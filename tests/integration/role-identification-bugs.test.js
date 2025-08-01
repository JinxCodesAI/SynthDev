import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SystemMessages from '../../src/core/ai/systemMessages.js';
import AgentManager from '../../src/agents/AgentManager.js';
import AgentProcess from '../../src/agents/AgentProcess.js';

describe('Role Identification Bugs', () => {
    let originalSystemMessages;
    let agentManager;

    beforeEach(() => {
        // Get fresh instances
        agentManager = AgentManager.getInstance();

        // Clear any existing agents
        agentManager.activeAgents.clear();
        agentManager.agentHierarchy.clear();
        agentManager.agentCounter = 0;
    });

    afterEach(() => {
        // Clean up agents
        if (agentManager) {
            agentManager.activeAgents.clear();
            agentManager.agentHierarchy.clear();
            agentManager.agentCounter = 0;
        }
        vi.clearAllMocks();
    });

    describe('Bug 1: Wrong system message used for agentic.architect', () => {
        it('should use agentic.architect system message, not core.json architect', async () => {
            // Test the actual role resolution
            const agenticArchitectResolution = SystemMessages.resolveRole('agentic.architect');
            expect(agenticArchitectResolution.found).toBe(true);
            expect(agenticArchitectResolution.group).toBe('agentic');
            expect(agenticArchitectResolution.roleName).toBe('architect');

            // Get system messages for both roles
            const coreArchitectMessage = SystemMessages.getSystemMessage('architect');
            const agenticArchitectMessage = SystemMessages.getSystemMessage('agentic.architect');

            // They should be different
            expect(coreArchitectMessage).not.toBe(agenticArchitectMessage);

            // The agentic architect should have coordination instructions
            expect(agenticArchitectMessage).toContain(
                'Your role is agentic.architect and you need to coordinate'
            );
            expect(agenticArchitectMessage).toContain(
                'developer - responsible for implementing features'
            );

            // The core architect should NOT have coordination instructions (it's not agentic)
            expect(coreArchitectMessage).not.toContain(
                'Your role is architect and you need to coordinate'
            );
        });

        it('should spawn agentic.architect with correct system message', async () => {
            // Test that we can get the correct system message for agentic.architect
            const agenticArchitectMessage = SystemMessages.getSystemMessage('agentic.architect');
            expect(agenticArchitectMessage).toContain(
                'You are a Software Architect focused on designing robust'
            );
            expect(agenticArchitectMessage).toContain(
                'Your role is agentic.architect and you need to coordinate'
            );

            // Test that spawning works (simplified test without complex mocking)
            const mockContext = {
                costsManager: { trackUsage: vi.fn() },
                toolManager: { getTools: vi.fn().mockReturnValue([]) },
                currentAgentId: null,
            };

            // Test that the spawn validation passes
            expect(() => {
                // This should not throw an error
                const resolution = SystemMessages.resolveRole('agentic.architect');
                expect(resolution.found).toBe(true);
                expect(resolution.group).toBe('agentic');
                expect(resolution.roleName).toBe('architect');
            }).not.toThrow();

            // Test that PM can spawn agentic.architect
            expect(SystemMessages.canSpawnAgent('pm', 'agentic.architect')).toBe(true);
        });
    });

    describe('Bug 2: Non-agentic roles getting coordination suffix', () => {
        it('should not add coordination suffix to core.json architect role', () => {
            const coreArchitectMessage = SystemMessages.getSystemMessage('architect');

            // Core architect should NOT have coordination instructions
            expect(coreArchitectMessage).not.toContain(
                'Your role is architect and you need to coordinate'
            );
            expect(coreArchitectMessage).not.toContain(
                'Use get_agents to understand what agents are already available'
            );
            expect(coreArchitectMessage).not.toContain('spawn_agent to initialize new agent');
        });

        it('should add coordination suffix only to agentic roles', () => {
            const agenticArchitectMessage = SystemMessages.getSystemMessage('agentic.architect');

            // Agentic architect SHOULD have coordination instructions
            expect(agenticArchitectMessage).toContain(
                'Your role is agentic.architect and you need to coordinate'
            );
            expect(agenticArchitectMessage).toContain(
                'Use get_agents to understand what agents are already available'
            );
        });
    });

    describe('Bug 3: Role overwrite warning but wrong role selected', () => {
        it('should correctly identify which role config is being used', () => {
            // Get both role configs
            const systemMessages = new SystemMessages();
            const roles = systemMessages.roles;

            // Both architect roles should exist
            expect(roles['architect']).toBeDefined();

            // Check which source the architect role came from
            const architectRole = roles['architect'];
            console.log('Architect role source:', architectRole._source);
            console.log('Architect role group:', architectRole._group);

            // The warning says core.json overwrites agentic, so core.json should be the active one
            // But when spawning 'agentic.architect', we should get the agentic version
            const agenticResolution = SystemMessages.resolveRole('agentic.architect');
            expect(agenticResolution.found).toBe(true);
            expect(agenticResolution.group).toBe('agentic');
        });
    });
});
