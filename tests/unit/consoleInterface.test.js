// tests/unit/consoleInterface.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ConsoleInterface from '../../consoleInterface.js';

// Mock dependencies
vi.mock('readline', () => ({
    createInterface: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../uiConfigManager.js', () => ({
    getUIConfigManager: vi.fn(),
}));

vi.mock('../../configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(),
}));

describe('ConsoleInterface', () => {
    let consoleInterface;
    let mockReadline;
    let mockLogger;
    let mockRl;
    let mockUIConfigManager;

    beforeEach(async () => {
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

        // Create mock UI config manager
        mockUIConfigManager = {
            getMessage: vi.fn((path, params = {}) => {
                const messages = {
                    'prompts.user': '💭 You: ',
                    'prefixes.assistant': '🤖 Synth-Dev:',
                    'status.thinking': '\n🧠 Synth-Dev is thinking...\n',
                    'status.executing_tools': '🔧 Executing tools...\n',
                    'status.enhancing_prompt': '\n🔄 \x1b[33mEnhancing prompt...\x1b[0m',
                    'prefixes.chain_of_thought': '💭 Chain of Thought:',
                    'prefixes.final_chain_of_thought': '💭 Final Chain of Thought:',
                    'prefixes.separator': '─',
                    'errors.tool_execution_failed': 'Tool execution failed',
                    'startup.title': '🚀 Synth-Dev Console Application Started!',
                    'startup.model_info': `🤖 Model: ${params.model || '{model}'}`,
                    'startup.role_info': `🎭 Role: ${params.role || '{role}'}`,
                    'startup.tools_info': `🔧 Tools: ${params.count || '{count}'} loaded`,
                    'startup.tools_filtered_info': `🔧 Tools: ${params.filtered || '{filtered}'}/${params.total || '{total}'} available (${params.excluded || '{excluded}'} filtered for role)`,
                    'startup.instructions':
                        'Type your message and press Enter to chat.\nUse /help for commands.',
                    goodbye: '👋 Goodbye!',
                    'prompts.confirmation': `\n❓ ${params.prompt || '{prompt}'}\n   Type "y" or "yes" to proceed, anything else to cancel:`,
                    'tools.cancelled': `Tool execution cancelled: ${params.toolName || '{toolName}'}\n`,
                    'enhancement.failure_message': `\n⚠️  \x1b[33mPrompt enhancement failed: ${params.error || '{error}'}\x1b[0m`,
                    'enhancement.proceeding_message': '📝 Proceeding with original prompt...\n',
                    'enhancement.approval_instruction':
                        '🔄 Press Esc to revert to original or ENTER to submit current prompt',
                    'enhancement.failure_header': '\n⚠️  \x1b[33mPrompt enhancement failed:\x1b[0m',
                    'enhancement.original_prompt_header': '\n📝 \x1b[36mOriginal prompt:\x1b[0m',
                    'enhancement.separator': '─',
                    'enhancement.options_header': '\n📝 You can:',
                    'enhancement.option_enter': '   • Press ENTER to use your original prompt',
                    'enhancement.option_modify': '   • Type your modifications and press ENTER',
                    'enhancement.option_cancel': '   • Type "cancel" to cancel the operation',
                    'enhancement.choice_prompt': '\n💭 Your choice: ',
                    'enhancement.cancel_keyword': 'cancel',
                };
                return messages[path] || `[Missing message: ${path}]`;
            }),
        };

        // Setup mocks
        const readlineModule = await import('readline');
        mockReadline = readlineModule;
        mockReadline.createInterface.mockReturnValue(mockRl);

        const loggerModule = await import('../../logger.js');
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
            expect(mockReadline.createInterface).toHaveBeenCalledWith({
                input: process.stdin,
                output: process.stdout,
                prompt: '💭 You: ',
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

            consoleInterface.showMessage(message);

            expect(mockLogger.user).toHaveBeenCalledWith(message, '🤖 Synth-Dev:');
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
            consoleInterface.showThinking();

            expect(mockLogger.status).toHaveBeenCalledWith('\n🧠 Synth-Dev is thinking...\n');
        });
    });

    describe('showChainOfThought', () => {
        it('should show chain of thought with formatting', () => {
            const content = 'Test thought process';

            consoleInterface.showChainOfThought(content);

            expect(mockLogger.raw).toHaveBeenCalledWith('💭 Chain of Thought:');
            expect(mockLogger.raw).toHaveBeenCalledWith('─'.repeat(50));
            expect(mockLogger.raw).toHaveBeenCalledWith(content);
            expect(mockLogger.raw).toHaveBeenCalledWith('─'.repeat(50));
            expect(mockLogger.raw).toHaveBeenCalledWith();
        });
    });

    describe('showFinalChainOfThought', () => {
        it('should show final chain of thought with formatting', () => {
            const content = 'Final thought process';

            consoleInterface.showFinalChainOfThought(content);

            expect(mockLogger.raw).toHaveBeenCalledWith('💭 Final Chain of Thought:');
            expect(mockLogger.raw).toHaveBeenCalledWith('─'.repeat(50));
            expect(mockLogger.raw).toHaveBeenCalledWith(content);
            expect(mockLogger.raw).toHaveBeenCalledWith('─'.repeat(50));
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

            consoleInterface.showStartupMessage(model, totalToolsCount);

            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🚀 Synth-Dev Console Application Started!')
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(expect.stringContaining('🤖 Model: gpt-4'));
            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🔧 Tools: 10 loaded')
            );
        });

        it('should show startup message with role', () => {
            const model = 'gpt-4';
            const totalToolsCount = 10;
            const role = 'assistant';

            consoleInterface.showStartupMessage(model, totalToolsCount, role);

            expect(mockLogger.raw).toHaveBeenCalledWith(
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

            expect(mockLogger.raw).toHaveBeenCalledWith(
                expect.stringContaining('🔧 Tools: 8/10 available (2 filtered for role)')
            );
        });
    });

    describe('showGoodbye', () => {
        it('should show goodbye message', () => {
            consoleInterface.showGoodbye();

            expect(mockLogger.raw).toHaveBeenCalledWith('👋 Goodbye!');
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
            consoleInterface.showEnhancingPrompt();

            expect(mockLogger.status).toHaveBeenCalledWith(
                '\n🔄 \x1b[33mEnhancing prompt...\x1b[0m'
            );
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
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '\n❓ Are you sure?\n   Type "y" or "yes" to proceed, anything else to cancel:'
            );
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
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '\n⚠️  \x1b[33mPrompt enhancement failed:\x1b[0m'
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(`   ${error}`);
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
