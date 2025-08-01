// tests/unit/agents/simple-agent-ids.test.js
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
        setCallbacks: vi.fn(),
        setTools: vi.fn(),
        addMessage: vi.fn(),
        sendMessage: vi.fn(() => Promise.resolve('Test response')),
    })),
}));

describe('Simple Agent IDs', () => {
    let agentManager;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton
        AgentManager.instance = null;
        agentManager = new AgentManager();
    });

    describe('_generateAgentId method', () => {
        it('should generate sequential agent IDs', () => {
            const id1 = agentManager._generateAgentId();
            const id2 = agentManager._generateAgentId();
            const id3 = agentManager._generateAgentId();

            expect(id1).toBe('agent-1');
            expect(id2).toBe('agent-2');
            expect(id3).toBe('agent-3');
        });

        it('should continue incrementing across multiple calls', () => {
            // Generate some IDs
            agentManager._generateAgentId(); // agent-1
            agentManager._generateAgentId(); // agent-2

            const id3 = agentManager._generateAgentId();
            const id4 = agentManager._generateAgentId();

            expect(id3).toBe('agent-3');
            expect(id4).toBe('agent-4');
        });

        it('should start from 1 for new manager instance', () => {
            const newManager = new AgentManager();
            const id = newManager._generateAgentId();
            expect(id).toBe('agent-1');
        });
    });

    describe('Agent spawning with simple IDs', () => {
        it('should create agents with sequential simple IDs', async () => {
            const mockContext = {
                currentAgentId: null,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            const result1 = await agentManager.spawnAgent('user', 'pm', 'Task 1', mockContext);
            const result2 = await agentManager.spawnAgent(
                'user',
                'architect',
                'Task 2',
                mockContext
            );

            expect(result1.agentId).toBe('agent-1');
            expect(result2.agentId).toBe('agent-2');
        });

        it('should maintain ID sequence across different spawn operations', async () => {
            const mockContext = {
                currentAgentId: null,
                costsManager: { trackCost: vi.fn() },
                toolManager: { getTools: vi.fn(() => []) },
            };

            // Spawn multiple agents
            const results = [];
            for (let i = 0; i < 5; i++) {
                const result = await agentManager.spawnAgent(
                    'user',
                    'pm',
                    `Task ${i + 1}`,
                    mockContext
                );
                results.push(result);
            }

            // Check that IDs are sequential
            expect(results[0].agentId).toBe('agent-1');
            expect(results[1].agentId).toBe('agent-2');
            expect(results[2].agentId).toBe('agent-3');
            expect(results[3].agentId).toBe('agent-4');
            expect(results[4].agentId).toBe('agent-5');
        });
    });
});
