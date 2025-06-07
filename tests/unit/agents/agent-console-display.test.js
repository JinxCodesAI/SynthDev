import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentProcess from '../../../src/agents/AgentProcess.js';
import AgentManager from '../../../src/agents/AgentManager.js';
import { createMockConsoleInterface } from '../../mocks/consoleInterface.js';

// Mock dependencies
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        toolExecutionDetailed: vi.fn(),
        toolResult: vi.fn(),
    }),
}));

vi.mock('../../../src/config/managers/configManager.js', () => ({
    default: {
        getInstance: () => ({
            getModel: () => ({
                apiKey: 'mock-api-key',
                baseUrl: 'https://mock-api.com',
                model: 'gpt-4.1-mini',
            }),
        }),
    },
}));

vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn(() => 'Mock system message'),
        getLevel: vi.fn(() => 'base'),
        isAgentic: vi.fn(() => true), // Add missing isAgentic method
        canSpawnAgent: vi.fn(() => true), // Add missing canSpawnAgent method
    },
}));

vi.mock('../../../src/core/ai/aiAPIClient.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        setSystemMessage: vi.fn(),
        addMessage: vi.fn(),
        setCallbacks: vi.fn(),
        sendUserMessage: vi.fn(),
        sendMessage: vi.fn(),
        canAcceptNewRequest: vi.fn(() => true),
        setTools: vi.fn(), // Add missing setTools method
        role: 'test_role',
    })),
}));

describe('Agent Console Display', () => {
    let mockConsoleInterface;
    let mockCostsManager;
    let mockToolManager;
    let mockAgentManager;

    beforeEach(() => {
        vi.clearAllMocks();
        mockConsoleInterface = createMockConsoleInterface();
        mockCostsManager = { trackCost: vi.fn() };
        mockToolManager = { getTools: vi.fn(() => []) };
        mockAgentManager = { getInstance: vi.fn() };
    });

    describe('AgentProcess with console interface', () => {
        it('should set up console display callbacks for agents with no parent', () => {
            const agent = new AgentProcess(
                'agent-1',
                'test_writer',
                'Write tests',
                null, // No parent (user-spawned)
                mockCostsManager,
                mockToolManager,
                mockAgentManager,
                null,
                mockConsoleInterface // Console interface provided
            );

            expect(agent.consoleInterface).toBe(mockConsoleInterface);
            expect(agent.parentId).toBe(null);
        });

        it('should not set console interface for agents with parent', () => {
            const agent = new AgentProcess(
                'agent-2',
                'test_writer',
                'Write tests',
                'parent-agent-1', // Has parent
                mockCostsManager,
                mockToolManager,
                mockAgentManager,
                null,
                mockConsoleInterface // Console interface provided but should not be used
            );

            expect(agent.consoleInterface).toBe(mockConsoleInterface);
            expect(agent.parentId).toBe('parent-agent-1');
        });
    });

    describe('AgentManager console interface passing', () => {
        let agentManager;

        beforeEach(() => {
            // Reset singleton
            AgentManager.instance = null;
            agentManager = new AgentManager();
        });

        it('should pass console interface to agents with no parent', async () => {
            const mockContext = {
                currentAgentId: null, // User spawning
                costsManager: mockCostsManager,
                toolManager: mockToolManager,
                app: {
                    consoleInterface: mockConsoleInterface,
                },
            };

            const result = await agentManager.spawnAgent(
                'user',
                'test_writer',
                'Write comprehensive tests',
                mockContext
            );

            const agent = agentManager.activeAgents.get(result.agentId);
            expect(agent.consoleInterface).toBe(mockConsoleInterface);
            expect(agent.parentId).toBe(null);
        });

        it('should not pass console interface to agents with parent', async () => {
            const mockContext = {
                currentAgentId: 'parent-agent-1', // Agent spawning
                costsManager: mockCostsManager,
                toolManager: mockToolManager,
                app: {
                    consoleInterface: mockConsoleInterface,
                },
            };

            const result = await agentManager.spawnAgent(
                'pm',
                'test_writer',
                'Write comprehensive tests',
                mockContext
            );

            const agent = agentManager.activeAgents.get(result.agentId);
            expect(agent.consoleInterface).toBe(null);
            expect(agent.parentId).toBe('parent-agent-1');
        });
    });

    describe('Agent completion notification', () => {
        let agentManager;

        beforeEach(() => {
            // Reset singleton
            AgentManager.instance = null;
            agentManager = new AgentManager();
        });

        it('should display completion message in console for user-spawned agents', async () => {
            // Create a mock agent with console interface
            const mockAgent = {
                agentId: 'agent-1',
                roleName: 'test_writer',
                parentId: null, // User-spawned
                consoleInterface: mockConsoleInterface,
            };

            agentManager.activeAgents.set('agent-1', mockAgent);

            const result = {
                status: 'success',
                summary: 'Tests written successfully',
                artifacts: [{ file_path: 'test.js', description: 'Unit tests' }],
                known_issues: ['Minor formatting issue'],
            };

            await agentManager._notifyParentOfCompletion('agent-1', result);

            expect(mockConsoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Agent test_writer (agent-1) has completed')
            );
            expect(mockConsoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Tests written successfully')
            );
            expect(mockConsoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('test.js: Unit tests')
            );
            expect(mockConsoleInterface.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Minor formatting issue')
            );
            expect(mockConsoleInterface.newLine).toHaveBeenCalled();
        });

        it('should not display completion message for agents with parent', async () => {
            // Create a mock agent with parent
            const mockAgent = {
                agentId: 'agent-2',
                roleName: 'test_writer',
                parentId: 'parent-agent-1', // Has parent
                consoleInterface: mockConsoleInterface,
                sendUserMessage: vi.fn(),
            };

            const mockParentAgent = {
                agentId: 'parent-agent-1',
                sendUserMessage: vi.fn(),
            };

            agentManager.activeAgents.set('agent-2', mockAgent);
            agentManager.activeAgents.set('parent-agent-1', mockParentAgent);

            const result = {
                status: 'success',
                summary: 'Tests written successfully',
                artifacts: [],
                known_issues: [],
            };

            await agentManager._notifyParentOfCompletion('agent-2', result);

            // Should not call console interface for agents with parent
            expect(mockConsoleInterface.showMessage).not.toHaveBeenCalled();
            expect(mockConsoleInterface.newLine).not.toHaveBeenCalled();

            // Should notify parent agent instead
            expect(mockParentAgent.sendUserMessage).toHaveBeenCalledWith(
                expect.stringContaining('Agent test_writer (agent-2) has completed')
            );
        });
    });
});
