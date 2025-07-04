// tests/unit/consoleInterface.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConsoleInterface from '../../consoleInterface.js';

// Mock dependencies
vi.mock('readline', () => ({
    createInterface: vi.fn(),
}));

vi.mock('../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../uiConfigManager.js', () => ({
    getUIConfigManager: vi.fn(),
}));

vi.mock('../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(),
}));

describe('ConsoleInterface', () => {
    let consoleInterface;
    let mockReadline;
    let mockLogger;
    let mockRl;
    let mockUIConfigManager;
    let realConfigMessages;
    let realApplicationConfig;

    // Helper function to load real configuration values
    const loadRealConfigValues = async () => {
        // Import the actual configuration loader to get real config values
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const { fileURLToPath } = await import('url');
        const { dirname } = await import('path');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const configDir = join(__dirname, '../../config');

        try {
            realConfigMessages = JSON.parse(
                readFileSync(join(configDir, 'ui/console-messages.json'), 'utf8')
            );
            realApplicationConfig = JSON.parse(
                readFileSync(join(configDir, 'defaults/application.json'), 'utf8')
            );
        } catch (error) {
            throw new Error(`Failed to load configuration files: ${error.message}`);
        }
    };

    beforeEach(async () => {
        // Load real configuration values
        await loadRealConfigValues();
        vi.clearAllMocks();

        // Create mock readline interface
        mockRl = {
            on: vi.fn(),
            removeAllListeners: vi.fn(),
            removeListener: vi.fn(),
            listeners: vi.fn().mockReturnValue([]),
            prompt: vi.fn(),
            pause: vi.fn(),
            resume: vi.fn(),
            close: vi.fn(),
        };

        // Create mock logger
        mockLogger = {
            user: vi.fn(),
            status: vi.fn(),
            raw: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            toolExecutionDetailed: vi.fn(),
            toolResult: vi.fn(),
        };

        // Create mock UI config manager that uses real config values
        mockUIConfigManager = {
            getMessage: vi.fn((path, params = {}) => {
                // Helper function to get nested value from config
                const getNestedValue = (obj, path) => {
                    return path.split('.').reduce((current, key) => current?.[key], obj);
                };

                // Helper function to format message with parameters
                const formatMessage = (message, params) => {
                    if (typeof message !== 'string') {
                        return message;
                    }
                    return message.replace(/\{(\w+)\}/g, (match, key) => {
                        return params[key] !== undefined ? params[key] : match;
                    });
                };

                // Special case for prompts.user - get from application config
                if (path === 'prompts.user') {
                    const promptPrefix = realApplicationConfig?.ui_settings?.promptPrefix;
                    if (!promptPrefix) {
                        throw new Error(
                            'Missing required configuration: ui_settings.promptPrefix in defaults/application.json'
                        );
                    }
                    return promptPrefix;
                }

                // Try to get value from real config
                const message = getNestedValue(realConfigMessages, path);

                // If not found in config, that's an error
                if (message === undefined) {
                    throw new Error(
                        `Missing required configuration: ${path} in ui/console-messages.json`
                    );
                }

                return formatMessage(message, params);
            }),
        };

        // Setup mocks
        const readlineModule = await import('readline');
        mockReadline = readlineModule;
        mockReadline.createInterface.mockReturnValue(mockRl);

        const loggerModule = await import('../../src/core/managers/logger.js');
        loggerModule.getLogger.mockReturnValue(mockLogger);

        const uiConfigModule = await import('../../uiConfigManager.js');
        uiConfigModule.getUIConfigManager.mockReturnValue(mockUIConfigManager);

        // Create ConsoleInterface instance
        consoleInterface = new ConsoleInterface();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            const expectedPrompt = realApplicationConfig.ui_settings.promptPrefix;
            expect(expectedPrompt).toBeDefined(); // Ensure config value exists
            expect(mockReadline.createInterface).toHaveBeenCalledWith({
                input: process.stdin,
                output: process.stdout,
                prompt: expectedPrompt,
            });
            expect(consoleInterface.rl).toBe(mockRl);
            expect(consoleInterface.isPaused).toBe(false);
            expect(consoleInterface.logger).toBe(mockLogger);
        });
    });

    describe('setupEventHandlers', () => {
        it('should setup line and close event handlers', () => {
            const onInput = vi.fn();
            const onClose = vi.fn();

            consoleInterface.setupEventHandlers(onInput, onClose);

            expect(mockRl.on).toHaveBeenCalledWith('line', onInput);
            expect(mockRl.on).toHaveBeenCalledWith('close', onClose);
        });
    });

    describe('prompt', () => {
        it('should call readline prompt when not paused', () => {
            consoleInterface.isPaused = false;

            consoleInterface.prompt();

            expect(mockRl.prompt).toHaveBeenCalled();
        });

        it('should not call readline prompt when paused', () => {
            consoleInterface.isPaused = true;

            consoleInterface.prompt();

            expect(mockRl.prompt).not.toHaveBeenCalled();
        });
    });

    describe('pauseInput', () => {
        it('should pause input and set paused state', () => {
            consoleInterface.pauseInput();

            expect(consoleInterface.isPaused).toBe(true);
            expect(mockRl.pause).toHaveBeenCalled();
        });
    });

    describe('resumeInput', () => {
        it('should resume input and prompt', () => {
            consoleInterface.isPaused = true;

            consoleInterface.resumeInput();

            expect(consoleInterface.isPaused).toBe(false);
            expect(mockRl.resume).toHaveBeenCalled();
            expect(mockRl.prompt).toHaveBeenCalled();
        });
    });

    describe('showMessage', () => {
        it('should show message with default prefix', () => {
            const message = 'Test message';
            const expectedPrefix = realConfigMessages.prefixes.assistant;
            expect(expectedPrefix).toBeDefined(); // Ensure config value exists

            consoleInterface.showMessage(message);

            expect(mockLogger.user).toHaveBeenCalledWith(message, expectedPrefix);
        });

        it('should show message with custom prefix', () => {
            const message = 'Test message';
            const prefix = 'Custom:';

            consoleInterface.showMessage(message, prefix);

            expect(mockLogger.user).toHaveBeenCalledWith(message, prefix);
        });
    });

    describe('showThinking', () => {
        it('should show thinking message', () => {
            const expectedMessage = realConfigMessages.status.thinking;
            expect(expectedMessage).toBeDefined(); // Ensure config value exists

            consoleInterface.showThinking();

            expect(mockLogger.status).toHaveBeenCalledWith(expectedMessage);
        });
    });

    describe('showChainOfThought', () => {
        it('should show chain of thought with formatting', () => {
            const content = 'Test thought process';
            const expectedPrefix = realConfigMessages.prefixes.chain_of_thought;
            const expectedSeparator = realConfigMessages.prefixes.separator;
            expect(expectedPrefix).toBeDefined(); // Ensure config value exists
            expect(expectedSeparator).toBeDefined(); // Ensure config value exists

            consoleInterface.showChainOfThought(content);

            expect(mockLogger.debug).toHaveBeenCalledWith(expectedPrefix);
            expect(mockLogger.debug).toHaveBeenCalledWith(expectedSeparator.repeat(50));
            expect(mockLogger.debug).toHaveBeenCalledWith(content);
            expect(mockLogger.debug).toHaveBeenCalledWith(expectedSeparator.repeat(50));
            expect(mockLogger.raw).toHaveBeenCalledWith();
        });
    });

    describe('showFinalChainOfThought', () => {
        it('should show final chain of thought with formatting', () => {
            const content = 'Final thought process';
            const expectedPrefix = realConfigMessages.prefixes.final_chain_of_thought;
            const expectedSeparator = realConfigMessages.prefixes.separator;
            expect(expectedPrefix).toBeDefined(); // Ensure config value exists
            expect(expectedSeparator).toBeDefined(); // Ensure config value exists

            consoleInterface.showFinalChainOfThought(content);

            expect(mockLogger.info).toHaveBeenCalledWith(expectedPrefix);
            expect(mockLogger.info).toHaveBeenCalledWith(expectedSeparator.repeat(50));
            expect(mockLogger.info).toHaveBeenCalledWith(content);
            expect(mockLogger.info).toHaveBeenCalledWith(expectedSeparator.repeat(50));
            expect(mockLogger.raw).toHaveBeenCalledWith();
        });
    });

    describe('showToolExecution', () => {
        it('should show tool execution details', () => {
            const toolName = 'test_tool';
            const args = { param: 'value' };

            consoleInterface.showToolExecution(toolName, args);

            expect(mockLogger.toolExecutionDetailed).toHaveBeenCalledWith(toolName, args);
        });
    });

    describe('showToolResult', () => {
        it('should show tool result', () => {
            const result = { success: true, data: 'test' };

            consoleInterface.showToolResult(result);

            expect(mockLogger.toolResult).toHaveBeenCalledWith(result);
        });
    });

    describe('showToolError', () => {
        it('should show tool error', () => {
            const error = new Error('Tool failed');

            consoleInterface.showToolError(error);

            expect(mockLogger.error).toHaveBeenCalledWith(error, 'Tool execution failed');
        });
    });

    describe('showExecutingTools', () => {
        it('should show executing tools message', () => {
            consoleInterface.showExecutingTools();

            expect(mockLogger.status).toHaveBeenCalledWith('🔧 Executing tools...\n');
        });
    });

    describe('showError', () => {
        it('should show error', () => {
            const error = new Error('Test error');

            consoleInterface.showError(error);

            expect(mockLogger.error).toHaveBeenCalledWith(error);
        });
    });

    describe('showStartupMessage', () => {
        it('should show basic startup message', () => {
            const model = 'gpt-4';
            const totalToolsCount = 10;
            const expectedTitle = realConfigMessages.startup.title;
            expect(expectedTitle).toBeDefined(); // Ensure config value exists

            consoleInterface.showStartupMessage(model, totalToolsCount);

            expect(mockLogger.user).toHaveBeenCalledWith(expect.stringContaining(expectedTitle));
            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('🤖 Model: gpt-4')
            );
            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('🔧 Tools: 10 loaded')
            );
        });

        it('should show startup message with role', () => {
            const model = 'gpt-4';
            const totalToolsCount = 10;
            const role = 'assistant';

            consoleInterface.showStartupMessage(model, totalToolsCount, role);

            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('🎭 Role: Assistant')
            );
        });

        it('should show startup message with filtered tools', () => {
            const model = 'gpt-4';
            const totalToolsCount = 8;
            const role = 'assistant';
            const allToolsCount = 10;
            const filteredToolsCount = 8;

            consoleInterface.showStartupMessage(
                model,
                totalToolsCount,
                role,
                allToolsCount,
                filteredToolsCount
            );

            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('🔧 Tools: 8/10 available (2 filtered for role)')
            );
        });

        it('should show startup message with environment info', () => {
            const model = 'gpt-4';
            const totalToolsCount = 10;
            const envInfo = '.env (loaded)';

            consoleInterface.showStartupMessage(model, totalToolsCount, null, null, null, envInfo);

            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('📄 Environment: .env (loaded)')
            );
        });

        it('should show startup message with git info', () => {
            const model = 'gpt-4';
            const totalToolsCount = 10;
            const gitInfo = 'branch: main';

            consoleInterface.showStartupMessage(
                model,
                totalToolsCount,
                null,
                null,
                null,
                null,
                gitInfo
            );

            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('🌿 Git: branch: main')
            );
        });

        it('should show startup message with both environment and git info', () => {
            const model = 'gpt-4';
            const totalToolsCount = 10;
            const envInfo = '.env (loaded)';
            const gitInfo = 'branch: main';

            consoleInterface.showStartupMessage(
                model,
                totalToolsCount,
                null,
                null,
                null,
                envInfo,
                gitInfo
            );

            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('📄 Environment: .env (loaded)')
            );
            expect(mockLogger.user).toHaveBeenCalledWith(
                expect.stringContaining('🌿 Git: branch: main')
            );
        });
    });

    describe('showGoodbye', () => {
        it('should show goodbye message', () => {
            const expectedMessage = realConfigMessages.goodbye;
            expect(expectedMessage).toBeDefined(); // Ensure config value exists

            consoleInterface.showGoodbye();

            expect(mockLogger.user).toHaveBeenCalledWith(expectedMessage);
        });
    });

    describe('newLine', () => {
        it('should show new line', () => {
            consoleInterface.newLine();

            expect(mockLogger.raw).toHaveBeenCalledWith();
        });
    });

    describe('close', () => {
        it('should close readline interface', () => {
            consoleInterface.close();

            expect(mockRl.close).toHaveBeenCalled();
        });
    });

    describe('showToolCancelled', () => {
        it('should show tool cancelled message', () => {
            const toolName = 'test_tool';

            consoleInterface.showToolCancelled(toolName);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Tool execution cancelled: test_tool\n',
                '🚫'
            );
        });
    });

    describe('showEnhancingPrompt', () => {
        it('should show enhancing prompt message', () => {
            const expectedMessage = realConfigMessages.status.enhancing_prompt;
            expect(expectedMessage).toBeDefined(); // Ensure config value exists

            consoleInterface.showEnhancingPrompt();

            expect(mockLogger.status).toHaveBeenCalledWith(expectedMessage);
        });
    });

    describe('showEnhancementError', () => {
        it('should show enhancement error message', () => {
            const error = 'Enhancement failed';

            consoleInterface.showEnhancementError(error);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                '\n⚠️  \x1b[33mPrompt enhancement failed: Enhancement failed\x1b[0m'
            );
            expect(mockLogger.info).toHaveBeenCalledWith('📝 Proceeding with original prompt...\n');
        });
    });

    describe('promptForConfirmation', () => {
        it('should return true for "y" input', async () => {
            const prompt = 'Are you sure?';

            // Mock the readline behavior
            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    // Simulate user typing "y"
                    setTimeout(() => handler('y'), 0);
                }
            });

            const result = await consoleInterface.promptForConfirmation(prompt);

            expect(result).toBe(true);
            // Check that the confirmation message was displayed (using real config value)
            const expectedMessage = realConfigMessages.prompts.confirmation.replace(
                '{prompt}',
                prompt
            );
            expect(mockLogger.user).toHaveBeenCalledWith(expectedMessage);
        });

        it('should return true for "yes" input', async () => {
            const prompt = 'Are you sure?';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('yes'), 0);
                }
            });

            const result = await consoleInterface.promptForConfirmation(prompt);

            expect(result).toBe(true);
        });

        it('should return false for "n" input', async () => {
            const prompt = 'Are you sure?';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('n'), 0);
                }
            });

            const result = await consoleInterface.promptForConfirmation(prompt);

            expect(result).toBe(false);
        });

        it('should return false for any other input', async () => {
            const prompt = 'Are you sure?';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('maybe'), 0);
                }
            });

            const result = await consoleInterface.promptForConfirmation(prompt);

            expect(result).toBe(false);
        });

        it('should handle case insensitive input', async () => {
            const prompt = 'Are you sure?';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('YES'), 0);
                }
            });

            const result = await consoleInterface.promptForConfirmation(prompt);

            expect(result).toBe(true);
        });

        it('should restore paused state after confirmation', async () => {
            consoleInterface.isPaused = true;
            const prompt = 'Are you sure?';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('y'), 0);
                }
            });

            await consoleInterface.promptForConfirmation(prompt);

            expect(mockRl.pause).toHaveBeenCalled();
        });
    });

    describe('promptForInput', () => {
        it('should return user input', async () => {
            const prompt = 'Enter something: ';
            const userInput = 'test input';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler(userInput), 0);
                }
            });

            const result = await consoleInterface.promptForInput(prompt);

            expect(result).toBe(userInput);
        });

        it('should restore listeners after input', async () => {
            const prompt = 'Enter something: ';
            const originalListeners = [vi.fn(), vi.fn()];

            mockRl.listeners.mockReturnValue(originalListeners);
            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('test'), 0);
                }
            });

            await consoleInterface.promptForInput(prompt);

            expect(mockRl.removeAllListeners).toHaveBeenCalledWith('line');
            expect(mockRl.on).toHaveBeenCalledWith('line', originalListeners[0]);
            expect(mockRl.on).toHaveBeenCalledWith('line', originalListeners[1]);
        });

        it('should handle paused state restoration', async () => {
            consoleInterface.isPaused = true;
            const prompt = 'Enter something: ';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('test'), 0);
                }
            });

            await consoleInterface.promptForInput(prompt);

            expect(mockRl.resume).toHaveBeenCalled();
            expect(mockRl.pause).toHaveBeenCalled();
        });
    });

    describe('promptForEnhancementFailureAction', () => {
        it('should return cancel action for "cancel" input', async () => {
            const error = 'Enhancement failed';
            const originalPrompt = 'Original prompt';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler('cancel'), 0);
                }
            });

            const result = await consoleInterface.promptForEnhancementFailureAction(
                error,
                originalPrompt
            );

            expect(result).toEqual({ cancel: true });
            const expectedHeader = realConfigMessages.enhancement.failure_header;
            expect(expectedHeader).toBeDefined(); // Ensure config value exists
            expect(mockLogger.user).toHaveBeenCalledWith(expectedHeader);
            expect(mockLogger.user).toHaveBeenCalledWith(`   ${error}`);
        });

        it('should return useOriginal for empty input', async () => {
            const error = 'Enhancement failed';
            const originalPrompt = 'Original prompt';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler(''), 0);
                }
            });

            const result = await consoleInterface.promptForEnhancementFailureAction(
                error,
                originalPrompt
            );

            expect(result).toEqual({ useOriginal: true });
        });

        it('should return useModified for custom input', async () => {
            const error = 'Enhancement failed';
            const originalPrompt = 'Original prompt';
            const customInput = 'Modified prompt';

            mockRl.on.mockImplementation((event, handler) => {
                if (event === 'line') {
                    setTimeout(() => handler(customInput), 0);
                }
            });

            const result = await consoleInterface.promptForEnhancementFailureAction(
                error,
                originalPrompt
            );

            expect(result).toEqual({
                useModified: true,
                finalPrompt: customInput,
            });
        });
    });

    describe('promptForEnhancedPromptApproval', () => {
        it('should return useOriginal when enhanced equals original', async () => {
            const enhancedPrompt = 'Same prompt';
            const originalPrompt = 'Same prompt';

            // Mock promptForEditableInput to return the original prompt
            consoleInterface.promptForEditableInput = vi.fn().mockResolvedValue(originalPrompt);

            const result = await consoleInterface.promptForEnhancedPromptApproval(
                enhancedPrompt,
                originalPrompt
            );

            expect(result).toEqual({ useOriginal: true });
        });

        it('should return useEnhanced when input equals enhanced', async () => {
            const enhancedPrompt = 'Enhanced prompt';
            const originalPrompt = 'Original prompt';

            consoleInterface.promptForEditableInput = vi.fn().mockResolvedValue(enhancedPrompt);

            const result = await consoleInterface.promptForEnhancedPromptApproval(
                enhancedPrompt,
                originalPrompt
            );

            expect(result).toEqual({
                useEnhanced: true,
                finalPrompt: enhancedPrompt,
            });
        });

        it('should return useModified for custom input', async () => {
            const enhancedPrompt = 'Enhanced prompt';
            const originalPrompt = 'Original prompt';
            const customPrompt = 'Custom modified prompt';

            consoleInterface.promptForEditableInput = vi.fn().mockResolvedValue(customPrompt);

            const result = await consoleInterface.promptForEnhancedPromptApproval(
                enhancedPrompt,
                originalPrompt
            );

            expect(result).toEqual({
                useModified: true,
                finalPrompt: customPrompt,
            });
        });

        it('should return useOriginal when user presses escape', async () => {
            const enhancedPrompt = 'Enhanced prompt';
            const originalPrompt = 'Original prompt';

            consoleInterface.promptForEditableInput = vi.fn().mockResolvedValue(null);

            const result = await consoleInterface.promptForEnhancedPromptApproval(
                enhancedPrompt,
                originalPrompt
            );

            expect(result).toEqual({ useOriginal: true });
        });
    });
});
