// tests/unit/agents/parent-child-relationships.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AgentManager from '../../../src/agents/AgentManager.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    })),
}));

// Mock SystemMessages
vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        canSpawnAgent: vi.fn(() => true),
        isAgentic: vi.fn(() => true),
        getLevel: vi.fn(() => 'base'),
        getSystemMessage: vi.fn(() => 'Test system message'),
    },
}));

// Mock ConfigManager
vi.mock('../../../src/config/managers/configManager.js', () => ({
    default: {
        getInstance: vi.fn(() => ({
            getModel: vi.fn(() => ({
                apiKey: 'test-key',
                baseUrl: 'test-url',
                model: 'test-model',
            })),
        })),
    },
}));

// Mock AIAPIClient
vi.mock('../../../src/core/ai/aiAPIClient.js', () => ({
    default: vi.fn(() => ({
        setSystemMessage: vi.fn(),
        addMessage: vi.fn(),
        sendMessage: vi.fn(() => Promise.resolve('Test response')),
    })),
}));

describe('Parent-Child Relationships', () => {
    let agentManager;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton
        AgentManager.instance = null;
        agentManager = new AgentManager();
    });

    describe('User spawning agentic roles', () => {
        it('should create root agents with null parent when user spawns them', async () => {
            const mockContext = {
                currentAgentId: null, // User has no agent ID
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            const result = await agentManager.spawnAgent(
                'user',
                'pm',
                'Create web app',
                mockContext
            );
            const agent = agentManager.activeAgents.get(result.agentId);

            expect(agent.parentId).toBe(null);
            expect(result.agentId).toBe('agent-1');
        });
    });

    describe('Agentic roles spawning other agents', () => {
        it('should set correct parent-child relationships', async () => {
            // First, user spawns PM agent
            const userContext = {
                currentAgentId: null,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            const pmResult = await agentManager.spawnAgent(
                'user',
                'pm',
                'Create web app',
                userContext
            );
            expect(pmResult.agentId).toBe('agent-1');

            // Then PM spawns architect agent
            const pmContext = {
                currentAgentId: pmResult.agentId, // PM is the current agent
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            const architectResult = await agentManager.spawnAgent(
                'pm',
                'architect',
                'Design system',
                pmContext
            );
            const architectAgent = agentManager.activeAgents.get(architectResult.agentId);

            expect(architectResult.agentId).toBe('agent-2');
            expect(architectAgent.parentId).toBe(pmResult.agentId);
            expect(architectAgent.parentId).toBe('agent-1');
        });

        it('should handle multi-level hierarchies correctly', async () => {
            // User -> PM -> Architect -> Developer
            const userContext = {
                currentAgentId: null,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            // User spawns PM
            const pmResult = await agentManager.spawnAgent(
                'user',
                'pm',
                'Create web app',
                userContext
            );

            // PM spawns Architect
            const pmContext = {
                currentAgentId: pmResult.agentId,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };
            const architectResult = await agentManager.spawnAgent(
                'pm',
                'architect',
                'Design system',
                pmContext
            );

            // Architect spawns Developer
            const architectContext = {
                currentAgentId: architectResult.agentId,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };
            const developerResult = await agentManager.spawnAgent(
                'architect',
                'developer',
                'Implement features',
                architectContext
            );

            // Check the hierarchy
            const pmAgent = agentManager.activeAgents.get(pmResult.agentId);
            const architectAgent = agentManager.activeAgents.get(architectResult.agentId);
            const developerAgent = agentManager.activeAgents.get(developerResult.agentId);

            expect(pmAgent.parentId).toBe(null); // Root agent
            expect(architectAgent.parentId).toBe(pmResult.agentId);
            expect(developerAgent.parentId).toBe(architectResult.agentId);

            // Check IDs are sequential
            expect(pmResult.agentId).toBe('agent-1');
            expect(architectResult.agentId).toBe('agent-2');
            expect(developerResult.agentId).toBe('agent-3');
        });
    });

    describe('Agent hierarchy tracking', () => {
        it('should track parent-child relationships in hierarchy map', async () => {
            const userContext = {
                currentAgentId: null,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            const pmResult = await agentManager.spawnAgent(
                'user',
                'pm',
                'Create web app',
                userContext
            );

            const pmContext = {
                currentAgentId: pmResult.agentId,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            const architectResult = await agentManager.spawnAgent(
                'pm',
                'architect',
                'Design system',
                pmContext
            );
            const developerResult = await agentManager.spawnAgent(
                'pm',
                'developer',
                'Implement features',
                pmContext
            );

            // Check hierarchy tracking
            const pmChildren = agentManager.agentHierarchy.get(pmResult.agentId);
            expect(pmChildren).toBeDefined();
            expect(pmChildren.has(architectResult.agentId)).toBe(true);
            expect(pmChildren.has(developerResult.agentId)).toBe(true);
            expect(pmChildren.size).toBe(2);
        });
    });
});
