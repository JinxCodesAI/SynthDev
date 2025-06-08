// tests/unit/commands/cmdCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CmdCommand } from '../../../commands/terminal/CmdCommand.js';

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(),
}));

// Mock CommandGenerator
vi.mock('../../../commands/terminal/CommandGenerator.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        generateCommand: vi.fn(),
    })),
}));

// Mock execute_terminal
vi.mock('../../../tools/execute_terminal/implementation.js', () => ({
    default: vi.fn(),
}));

describe('CmdCommand', () => {
    let cmdCommand;
    let mockLogger;
    let mockContext;
    let mockCommandGenerator;
    let mockExecuteTerminal;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Setup CommandGenerator mock
        const CommandGenerator = (await import('../../../commands/terminal/CommandGenerator.js'))
            .default;
        mockCommandGenerator = {
            generateCommand: vi.fn().mockResolvedValue({
                success: true,
                command: 'git status',
            }),
        };
        CommandGenerator.mockImplementation(() => mockCommandGenerator);

        // Setup execute_terminal mock
        mockExecuteTerminal = (await import('../../../tools/execute_terminal/implementation.js'))
            .default;
        mockExecuteTerminal.mockResolvedValue({
            success: true,
            stdout: 'On branch main\nnothing to commit, working tree clean',
            stderr: '',
        });

        // Create mock context
        mockContext = {
            toolManager: {
                getTools: vi.fn().mockReturnValue([]),
            },
            costsManager: {
                addCost: vi.fn(),
            },
            apiClient: {
                addUserMessage: vi.fn(),
            },
            consoleInterface: {
                promptForInput: vi.fn(),
                promptForConfirmation: vi.fn(),
                promptForEditableInput: vi.fn(),
            },
        };

        // Create CmdCommand instance
        cmdCommand = new CmdCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(cmdCommand.name).toBe('cmd');
            expect(cmdCommand.description).toBe('Execute terminal commands with AI assistance');
            expect(cmdCommand.aliases).toEqual(['command', 'terminal']);
            expect(cmdCommand.commandHistory).toEqual([]);
            expect(cmdCommand.contextIntegrationEnabled).toBe(false);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = cmdCommand.getRequiredDependencies();
            expect(dependencies).toContain('toolManager');
            expect(dependencies).toContain('costsManager');
            expect(dependencies).toContain('apiClient');
            expect(dependencies).toContain('consoleInterface');
        });
    });

    describe('implementation', () => {
        it('should show usage when no args provided', async () => {
            const result = await cmdCommand.implementation('', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('🔧 Terminal Command Execution\n');
            expect(mockLogger.raw).toHaveBeenCalledWith('Usage:');
        });

        it('should show command history', async () => {
            cmdCommand.commandHistory = [
                {
                    command: 'git status',
                    timestamp: '2024-01-15T10:30:00.000Z',
                    success: true,
                    originalRequest: null,
                },
            ];

            const result = await cmdCommand.implementation('history', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('📜 Command History:\n');
            expect(mockLogger.raw).toHaveBeenCalledWith(expect.stringContaining('1. ✅'));
            expect(mockLogger.raw).toHaveBeenCalledWith(expect.stringContaining('git status'));
        });

        it('should show empty history message', async () => {
            const result = await cmdCommand.implementation('history', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('📜 No commands in history\n');
        });

        it('should enable context integration', async () => {
            const result = await cmdCommand.implementation('context on', mockContext);

            expect(result).toBe(true);
            expect(cmdCommand.contextIntegrationEnabled).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '✅ Context integration enabled - commands and results will be added to chat history\n'
            );
        });

        it('should disable context integration', async () => {
            cmdCommand.contextIntegrationEnabled = true;

            const result = await cmdCommand.implementation('context off', mockContext);

            expect(result).toBe(true);
            expect(cmdCommand.contextIntegrationEnabled).toBe(false);
            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Context integration disabled\n');
        });

        it('should show context status', async () => {
            const result = await cmdCommand.implementation('context', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                'ℹ️  Context integration is currently disabled'
            );
        });

        it('should execute direct command', async () => {
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await cmdCommand.implementation('git status', mockContext);

            expect(result).toBe(true);
            expect(mockExecuteTerminal).toHaveBeenCalledWith({ command: 'git status' });
            expect(mockLogger.raw).toHaveBeenCalledWith('⚡ Executing: git status\n');
            expect(mockLogger.raw).toHaveBeenCalledWith('✅ Command completed successfully\n');
        });

        it('should handle AI generation request', async () => {
            mockContext.consoleInterface.promptForEditableInput.mockResolvedValue(
                '/cmd git status'
            );
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await cmdCommand.implementation('??? check git status', mockContext);

            expect(result).toBe(true);
            expect(mockCommandGenerator.generateCommand).toHaveBeenCalledWith('check git status');
            expect(mockContext.consoleInterface.promptForEditableInput).toHaveBeenCalledWith(
                '💭 You: ',
                '/cmd git status',
                '/cmd ??? check git status'
            );
        });

        it('should handle AI generation cancellation', async () => {
            mockContext.consoleInterface.promptForEditableInput.mockResolvedValue(null);

            const result = await cmdCommand.implementation('??? check git status', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('🚫 Command generation cancelled\n');
        });

        it('should handle AI generation failure', async () => {
            mockCommandGenerator.generateCommand.mockResolvedValue({
                success: false,
                error: 'Failed to generate command',
            });

            const result = await cmdCommand.implementation('??? check git status', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '❌ Failed to generate command: Failed to generate command\n'
            );
        });

        it('should handle empty description for AI generation', async () => {
            const result = await cmdCommand.implementation('???', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '❌ Please provide a description of what you want to do after ???\n'
            );
        });

        it('should handle command execution failure', async () => {
            mockExecuteTerminal.mockResolvedValue({
                success: false,
                stdout: '',
                stderr: 'Command not found',
                error: 'Exit code 1',
            });
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            const result = await cmdCommand.implementation('invalidcommand', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Command failed\n');
            expect(mockLogger.raw).toHaveBeenCalledWith('❌ Error:');
            expect(mockLogger.raw).toHaveBeenCalledWith('Command not found');
        });

        it('should add command to history', async () => {
            mockContext.consoleInterface.promptForConfirmation.mockResolvedValue(false);

            await cmdCommand.implementation('git status', mockContext);

            expect(cmdCommand.commandHistory).toHaveLength(1);
            expect(cmdCommand.commandHistory[0]).toMatchObject({
                command: 'git status',
                success: true,
                originalRequest: null,
            });
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = cmdCommand.getUsage();
            expect(usage).toBe('/cmd <command> | /cmd ??? <description>');
        });
    });
});
