// tests/unit/agents/AgentProcess.stateManagement.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AgentProcess from '../../../src/agents/AgentProcess.js';

// Mock dependencies
vi.mock('../../../src/core/ai/aiAPIClient.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn(),
        getLevel: vi.fn(),
    },
}));

vi.mock('../../../src/config/managers/configManager.js', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

describe('AgentProcess State Management', () => {
    let agentProcess;
    let mockAPIClient;
    let mockLogger;
    let mockCostsManager;
    let mockToolManager;
    let mockAgentManager;
    let mockConfig;
    let mockSystemMessages;

    beforeEach(async () => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock API client
        mockAPIClient = {
            setTools: vi.fn(),
            setCallbacks: vi.fn(),
            setSystemMessage: vi.fn(),
            addMessage: vi.fn(),
            sendUserMessage: vi.fn(),
            sendMessage: vi.fn(),
            isReady: vi.fn(),
            canAcceptNewRequest: vi.fn(),
            getProcessingState: vi.fn(),
        };

        // Mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Mock other dependencies
        mockCostsManager = { addUsage: vi.fn() };
        mockToolManager = {
            getTools: vi.fn().mockReturnValue([]),
            executeToolCall: vi.fn(),
        };
        mockAgentManager = {};

        mockConfig = {
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseUrl: 'https://api.test.com',
                model: 'test-model',
            }),
        };

        mockSystemMessages = {
            getSystemMessage: vi.fn().mockReturnValue('Test system message'),
            getLevel: vi.fn().mockReturnValue('base'),
        };

        // Set up module mocks
        const { default: AIAPIClient } = await import('../../../src/core/ai/aiAPIClient.js');
        const { default: SystemMessages } = await import('../../../src/core/ai/systemMessages.js');
        const { default: ConfigManager } = await import(
            '../../../src/config/managers/configManager.js'
        );
        const { getLogger } = await import('../../../src/core/managers/logger.js');

        AIAPIClient.mockImplementation(() => mockAPIClient);
        Object.assign(SystemMessages, mockSystemMessages);
        ConfigManager.getInstance.mockReturnValue(mockConfig);
        getLogger.mockReturnValue(mockLogger);

        // Create AgentProcess instance
        agentProcess = new AgentProcess(
            'test-agent-1',
            'test-role',
            'Test task prompt',
            null,
            mockCostsManager,
            mockToolManager,
            mockAgentManager
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendUserMessage State-Based Logic', () => {
        it('should force request when API client can accept new request', async () => {
            // Reset mocks to clear constructor calls
            mockAPIClient.addMessage.mockClear();
            mockAPIClient.sendUserMessage.mockClear();

            // Mock API client state as ready
            mockAPIClient.canAcceptNewRequest.mockReturnValue(true);
            mockAPIClient.getProcessingState.mockReturnValue('idle');
            mockAPIClient.sendUserMessage.mockResolvedValue('Response');

            const result = await agentProcess.sendUserMessage('Test message');

            expect(mockAPIClient.canAcceptNewRequest).toHaveBeenCalled();
            expect(mockAPIClient.sendUserMessage).toHaveBeenCalledWith('Test message');
            expect(mockAPIClient.addMessage).not.toHaveBeenCalled();
            expect(result).toBe('Response');
        });

        it('should queue message when API client is preparing', () => {
            // Mock API client state as preparing
            mockAPIClient.canAcceptNewRequest.mockReturnValue(false);
            mockAPIClient.getProcessingState.mockReturnValue('preparing');

            agentProcess.sendUserMessage('Test message');

            expect(mockAPIClient.canAcceptNewRequest).toHaveBeenCalled();
            expect(mockAPIClient.sendUserMessage).not.toHaveBeenCalled();
            // Should queue the message, not add it directly
            expect(agentProcess.messageQueue).toContain('Test message');
        });

        it('should queue message when API client is making API call', () => {
            // Mock API client state as making API call
            mockAPIClient.canAcceptNewRequest.mockReturnValue(false);
            mockAPIClient.getProcessingState.mockReturnValue('api_calling');

            agentProcess.sendUserMessage('Test message');

            expect(mockAPIClient.canAcceptNewRequest).toHaveBeenCalled();
            expect(mockAPIClient.sendUserMessage).not.toHaveBeenCalled();
            // Should queue the message, not add it directly
            expect(agentProcess.messageQueue).toContain('Test message');
        });

        it('should queue message when API client is processing tools', () => {
            // Mock API client state as processing tools
            mockAPIClient.canAcceptNewRequest.mockReturnValue(false);
            mockAPIClient.getProcessingState.mockReturnValue('processing_tools');

            agentProcess.sendUserMessage('Test message');

            expect(mockAPIClient.canAcceptNewRequest).toHaveBeenCalled();
            expect(mockAPIClient.sendUserMessage).not.toHaveBeenCalled();
            // Should queue the message, not add it directly
            expect(agentProcess.messageQueue).toContain('Test message');
        });

        it('should queue message when API client is finalizing', () => {
            // Mock API client state as finalizing
            mockAPIClient.canAcceptNewRequest.mockReturnValue(false);
            mockAPIClient.getProcessingState.mockReturnValue('finalizing');

            agentProcess.sendUserMessage('Test message');

            expect(mockAPIClient.canAcceptNewRequest).toHaveBeenCalled();
            expect(mockAPIClient.sendUserMessage).not.toHaveBeenCalled();
            // Should queue the message, not add it directly
            expect(agentProcess.messageQueue).toContain('Test message');
        });

        it('should log decision-making process', () => {
            mockAPIClient.canAcceptNewRequest.mockReturnValue(true);
            mockAPIClient.getProcessingState.mockReturnValue('idle');
            mockAPIClient.sendUserMessage.mockResolvedValue('Response');

            agentProcess.sendUserMessage('Test message');

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Agent test-agent-1 sendUserMessage: state=idle, canAcceptNewRequest=true'
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Agent test-agent-1 forcing new request (state: idle)'
            );
        });

        it('should log queuing decision', () => {
            mockAPIClient.canAcceptNewRequest.mockReturnValue(false);
            mockAPIClient.getProcessingState.mockReturnValue('processing_tools');

            agentProcess.sendUserMessage('Test message');

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Agent test-agent-1 sendUserMessage: state=processing_tools, canAcceptNewRequest=false'
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Agent test-agent-1 queuing message for later processing (state: processing_tools)'
            );
        });
    });

    describe('Message Queuing System', () => {
        it('should process queued messages when API client becomes ready', async () => {
            // Reset mocks to clear constructor calls
            mockAPIClient.addMessage.mockClear();
            mockAPIClient.sendUserMessage.mockClear();

            // Initially not ready, then becomes ready
            let callCount = 0;
            mockAPIClient.canAcceptNewRequest.mockImplementation(() => {
                callCount++;
                return callCount > 2; // Becomes ready after a few checks
            });
            mockAPIClient.getProcessingState.mockReturnValue('api_calling');
            mockAPIClient.sendUserMessage.mockResolvedValue('Response');

            // Queue a message
            agentProcess.sendUserMessage('Test message');

            // Verify message was queued
            expect(agentProcess.messageQueue).toContain('Test message');

            // Wait a bit for queue processing
            await new Promise(resolve => setTimeout(resolve, 300));

            // Should eventually call sendUserMessage when ready
            expect(mockAPIClient.sendUserMessage).toHaveBeenCalledWith('Test message');
        });

        it('should handle multiple queued messages in order', async () => {
            // Reset mocks
            mockAPIClient.addMessage.mockClear();
            mockAPIClient.sendUserMessage.mockClear();

            // Not ready initially
            mockAPIClient.canAcceptNewRequest.mockReturnValue(false);
            mockAPIClient.getProcessingState.mockReturnValue('processing_tools');

            // Queue multiple messages
            agentProcess.sendUserMessage('Message 1');
            agentProcess.sendUserMessage('Message 2');
            agentProcess.sendUserMessage('Message 3');

            // Verify all messages were queued
            expect(agentProcess.messageQueue).toEqual(['Message 1', 'Message 2', 'Message 3']);
        });

        it('should not start multiple queue processors', () => {
            // Reset mocks
            mockAPIClient.canAcceptNewRequest.mockReturnValue(false);
            mockAPIClient.getProcessingState.mockReturnValue('api_calling');

            // Queue multiple messages quickly
            agentProcess.sendUserMessage('Message 1');
            agentProcess.sendUserMessage('Message 2');

            // Should only have one processor running
            expect(agentProcess.isProcessingQueue).toBe(true);
        });
    });

    describe('Integration with Existing Methods', () => {
        it('should not affect addMessage method', () => {
            const testMessage = { role: 'user', content: 'Test message' };

            agentProcess.addMessage(testMessage);

            expect(mockAPIClient.addMessage).toHaveBeenCalledWith(testMessage);
        });

        it('should not affect execute method', async () => {
            mockAPIClient.sendMessage.mockResolvedValue('Execution result');

            const result = await agentProcess.execute();

            expect(mockAPIClient.sendMessage).toHaveBeenCalled();
            expect(result).toBe('Execution result');
        });
    });
});
