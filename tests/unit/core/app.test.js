import { describe, it, expect, beforeEach, vi } from 'vitest';

import AICoderConsole from '../../../src/core/app.js';
import ConfigManager from '../../../src/config/managers/configManager.js';
import AIAPIClient from '../../../src/core/ai/aiAPIClient.js';
import CommandHandler from '../../../src/core/interface/commandHandler.js';
import ConsoleInterface from '../../../src/core/interface/consoleInterface.js';
import WorkflowStateMachine from '../../../src/workflow/WorkflowStateMachine.js';

// Mock dependencies
vi.mock('../../../src/config/managers/configManager.js');
vi.mock('../../../src/core/ai/aiAPIClient.js');
vi.mock('../../../src/core/managers/logger.js', () => ({
    initializeLogger: vi.fn(),
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    })),
}));
vi.mock('../../../src/core/interface/commandHandler.js');
vi.mock('../../../src/core/interface/consoleInterface.js');
vi.mock('../../../src/workflow/WorkflowStateMachine.js');
vi.mock('../../../src/core/ai/promptEnhancer.js', () => ({
    default: vi.fn(() => ({
        isEnabled: vi.fn(() => false),
        enhancePrompt: vi.fn(prompt => Promise.resolve({ success: true, enhancedPrompt: prompt })),
    })),
}));
vi.mock('../../../src/core/managers/costsManager.js', () => ({
    default: {
        addCost: vi.fn(),
        getCosts: vi.fn(() => ({ total: 0 })),
        resetCosts: vi.fn(),
    },
}));
vi.mock('../../../src/core/managers/toolManager.js', () => ({
    default: vi.fn(() => ({
        loadTools: vi.fn(),
        getTools: vi.fn(() => []),
        getToolsCount: vi.fn(() => 0),
        executeToolCall: vi.fn(),
    })),
}));
vi.mock('../../../src/core/snapshot/AutoSnapshotManager.js', () => ({
    AutoSnapshotManager: vi.fn(() => ({
        initialize: vi.fn(),
        integrateWithApplication: vi.fn(),
        cleanup: vi.fn(),
        getStatus: vi.fn(() => ({})),
    })),
}));
vi.mock('../../../src/utils/GitUtils.js', () => ({
    default: vi.fn(() => ({
        checkGitAvailability: vi.fn(() => Promise.resolve({ available: false, isRepo: false })),
        getCurrentBranch: vi.fn(() => Promise.resolve({ success: false })),
    })),
}));
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        getConfigDir: vi.fn(() => '/mock/config/dir'),
    })),
}));

describe('AICoderConsole - Input Routing', () => {
    let app;
    let mockConfigManagerInstance;
    let mockAIAPIClientInstance;
    let mockCommandHandlerInstance;
    let mockConsoleInterfaceInstance;
    let mockWorkflowStateMachineInstance;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock ConfigManager.getInstance to return a consistent mock
        mockConfigManagerInstance = {
            getConfig: vi.fn(() => ({
                ui: { currentMode: 'role:dude' },
                models: { base: { model: 'gpt-4-mini', baseUrl: 'url', apiKey: 'key' } },
            })),
            getModel: vi.fn(() => ({ model: 'gpt-4-mini', baseUrl: 'url', apiKey: 'key' })),
            shouldStartConfigurationWizard: vi.fn(() => false),
            getEnvFileInfo: vi.fn(() => ({ exists: false, path: '.env' })),
            setConfig: vi.fn(),
        };
        ConfigManager.getInstance.mockReturnValue(mockConfigManagerInstance);

        // Mock AIAPIClient constructor and instance methods
        mockAIAPIClientInstance = {
            setCallbacks: vi.fn(),
            setTools: vi.fn(),
            sendUserMessage: vi.fn(),
            getCurrentRole: vi.fn(() => 'dude'),
            getTotalToolCount: vi.fn(() => 0),
            getFilteredToolCount: vi.fn(() => 0),
            getModel: vi.fn(() => 'gpt-4-mini'),
            setSystemMessage: vi.fn(),
        };
        AIAPIClient.mockImplementation(() => mockAIAPIClientInstance);

        // Mock CommandHandler constructor and instance methods
        mockCommandHandlerInstance = {
            handleCommand: vi.fn(() => false), // Default: not a command
            commandRegistry: { getCommand: vi.fn(() => true) }, // Mock workflow command exists
        };
        CommandHandler.mockImplementation(() => mockCommandHandlerInstance);

        // Mock ConsoleInterface constructor and instance methods
        mockConsoleInterfaceInstance = {
            setupEventHandlers: vi.fn(),
            prompt: vi.fn(),
            showThinking: vi.fn(),
            pauseInput: vi.fn(),
            resumeInput: vi.fn(),
            showMessage: vi.fn(),
            newLine: vi.fn(),
            showExecutingTools: vi.fn(),
            showError: vi.fn(),
            showGoodbye: vi.fn(),
            showStartupMessage: vi.fn(),
        };
        ConsoleInterface.mockImplementation(() => mockConsoleInterfaceInstance);

        // Mock WorkflowStateMachine constructor and instance methods
        mockWorkflowStateMachineInstance = {
            loadWorkflowConfigs: vi.fn(),
            start: vi.fn(),
            handleUserInput: vi.fn(),
        };
        WorkflowStateMachine.mockImplementation(() => mockWorkflowStateMachineInstance);

        app = new AICoderConsole(mockConfigManagerInstance);
        app._initializeAPIComponents(); // Manually initialize components for testing handleInput
    });

    it('should process commands first', async () => {
        mockCommandHandlerInstance.handleCommand.mockResolvedValueOnce(true); // Simulate command handled

        await app.handleInput('/testcommand');

        expect(mockCommandHandlerInstance.handleCommand).toHaveBeenCalledWith('/testcommand');
        expect(mockConsoleInterfaceInstance.prompt).toHaveBeenCalled();
        expect(mockAIAPIClientInstance.sendUserMessage).not.toHaveBeenCalled();
        expect(mockWorkflowStateMachineInstance.handleUserInput).not.toHaveBeenCalled();
    });

    it('should route non-command input to AIAPIClient in role: mode', async () => {
        mockConfigManagerInstance.getConfig.mockReturnValueOnce({
            ui: { currentMode: 'role:coder' },
            models: { base: { model: 'gpt-4-mini', baseUrl: 'url', apiKey: 'key' } },
        });

        await app.handleInput('hello AI');

        expect(mockCommandHandlerInstance.handleCommand).toHaveBeenCalledWith('hello AI');
        expect(mockAIAPIClientInstance.sendUserMessage).toHaveBeenCalledWith('hello AI');
        expect(mockWorkflowStateMachineInstance.handleUserInput).not.toHaveBeenCalled();
        expect(mockConsoleInterfaceInstance.prompt).not.toHaveBeenCalled(); // Prompt is called by APIClient callback
    });

    it('should route non-command input to WorkflowStateMachine in workflow: mode', async () => {
        mockConfigManagerInstance.getConfig.mockReturnValueOnce({
            ui: { currentMode: 'workflow:test_workflow' },
            models: { base: { model: 'gpt-4-mini', baseUrl: 'url', apiKey: 'key' } },
        });
        app.activeWorkflow = mockWorkflowStateMachineInstance; // Set active workflow

        await app.handleInput('hello workflow');

        expect(mockCommandHandlerInstance.handleCommand).toHaveBeenCalledWith('hello workflow');
        expect(mockWorkflowStateMachineInstance.handleUserInput).toHaveBeenCalledWith(
            'hello workflow'
        );
        expect(mockAIAPIClientInstance.sendUserMessage).not.toHaveBeenCalled();
        expect(mockConsoleInterfaceInstance.prompt).not.toHaveBeenCalled(); // Prompt is called by workflow
    });

    it('should handle empty input', async () => {
        await app.handleInput('   ');

        expect(mockConsoleInterfaceInstance.prompt).toHaveBeenCalled();
        expect(mockCommandHandlerInstance.handleCommand).not.toHaveBeenCalled();
        expect(mockAIAPIClientInstance.sendUserMessage).not.toHaveBeenCalled();
        expect(mockWorkflowStateMachineInstance.handleUserInput).not.toHaveBeenCalled();
    });

    it('should log error for unknown mode', async () => {
        mockConfigManagerInstance.getConfig.mockReturnValueOnce({
            ui: { currentMode: 'unknown:mode' },
            models: { base: { model: 'gpt-4-mini', baseUrl: 'url', apiKey: 'key' } },
        });

        await app.handleInput('some input');

        expect(app.logger.error).toHaveBeenCalledWith('Unknown application mode: unknown:mode');
        expect(mockConsoleInterfaceInstance.prompt).toHaveBeenCalled();
        expect(mockAIAPIClientInstance.sendUserMessage).not.toHaveBeenCalled();
        expect(mockWorkflowStateMachineInstance.handleUserInput).not.toHaveBeenCalled();
    });

    it('should warn if workflow mode is active but no active workflow instance found', async () => {
        mockConfigManagerInstance.getConfig.mockReturnValueOnce({
            ui: { currentMode: 'workflow:test_workflow' },
            models: { base: { model: 'gpt-4-mini', baseUrl: 'url', apiKey: 'key' } },
        });
        app.activeWorkflow = null; // Simulate no active workflow

        await app.handleInput('hello workflow');

        expect(app.logger.warn).toHaveBeenCalledWith(
            'Workflow mode is active but no active workflow instance found.'
        );
        expect(mockConsoleInterfaceInstance.prompt).toHaveBeenCalled();
        expect(mockWorkflowStateMachineInstance.handleUserInput).not.toHaveBeenCalled();
    });
});
