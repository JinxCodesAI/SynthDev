// tests/unit/commands/commandGenerator.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CommandGenerator from '../../../src/commands/terminal/CommandGenerator.js';

// Mock dependencies
vi.mock('../../../src/config/managers/configManager.js', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../../../src/core/ai/aiAPIClient.js', () => ({
    default: vi.fn(),
}));

vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        getSystemMessage: vi.fn(),
    },
}));

vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

describe('CommandGenerator', () => {
    let commandGenerator;
    let mockConfigManager;
    let mockAIAPIClient;
    let mockSystemMessages;
    let mockLogger;
    let mockCostsManager;
    let mockToolManager;

    beforeEach(async () => {
        // Mock process.cwd() before tests
        process.cwd = vi.fn(() => '/test/workspace');
        vi.clearAllMocks();

        // Setup ConfigManager mock
        mockConfigManager = {
            hasFastModelConfig: vi.fn().mockReturnValue(true),
            getModel: vi.fn().mockReturnValue({
                apiKey: 'test-key',
                baseUrl: 'https://api.test.com',
                model: 'gpt-4',
            }),
        };
        const ConfigManager = (await import('../../../src/config/managers/configManager.js'))
            .default;
        ConfigManager.getInstance.mockReturnValue(mockConfigManager);

        // Setup AIAPIClient mock
        const mockAIClient = {
            setSystemMessage: vi.fn().mockResolvedValue(true),
            sendUserMessage: vi.fn().mockResolvedValue(true),
            setCallbacks: vi.fn(),
        };
        const AIAPIClient = (await import('../../../src/core/ai/aiAPIClient.js')).default;
        AIAPIClient.mockImplementation(() => mockAIClient);
        mockAIAPIClient = mockAIClient;

        // Setup SystemMessages mock
        mockSystemMessages = (await import('../../../src/core/ai/systemMessages.js')).default;
        mockSystemMessages.getSystemMessage.mockReturnValue('You are a command generator.');

        // Setup logger mock
        mockLogger = {
            debug: vi.fn(),
            error: vi.fn(),
        };
        const { getLogger } = await import('../../../src/core/managers/logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Create mock dependencies
        mockCostsManager = {
            addCost: vi.fn(),
        };
        mockToolManager = {
            getTools: vi.fn().mockReturnValue([]),
        };

        // Create CommandGenerator instance
        commandGenerator = new CommandGenerator(mockCostsManager, mockToolManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/test/workspace');
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(commandGenerator.costsManager).toBe(mockCostsManager);
            expect(commandGenerator.toolManager).toBe(mockToolManager);
            expect(commandGenerator.config).toBe(mockConfigManager);
            expect(commandGenerator.logger).toBe(mockLogger);
        });
    });

    describe('generateCommand', () => {
        it('should handle invalid description', async () => {
            const result = await commandGenerator.generateCommand('');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid description provided');
        });

        it('should handle null description', async () => {
            const result = await commandGenerator.generateCommand(null);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid description provided');
        });

        it('should handle general errors', async () => {
            mockAIAPIClient.setSystemMessage.mockRejectedValue(new Error('Network error'));

            const result = await commandGenerator.generateCommand('list files');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Command generation failed: Network error');
        });

        it('should use fast model when available', async () => {
            mockConfigManager.hasFastModelConfig.mockReturnValue(true);

            // This will fail due to no response, but we can test the model selection
            await commandGenerator.generateCommand('list files');

            expect(mockConfigManager.getModel).toHaveBeenCalledWith('fast');
        });

        it('should use base model when fast model not available', async () => {
            mockConfigManager.hasFastModelConfig.mockReturnValue(false);

            // This will fail due to no response, but we can test the model selection
            await commandGenerator.generateCommand('list files');

            expect(mockConfigManager.getModel).toHaveBeenCalledWith('base');
        });
    });

    describe('_createGenerationPrompt', () => {
        it('should create proper generation prompt', () => {
            const prompt = commandGenerator._createGenerationPrompt('list all files');

            expect(prompt).toContain('Generate a terminal command for the following request:');
            expect(prompt).toContain('Request: "list all files"');
            expect(prompt).toContain('Operating System:');
            expect(prompt).toContain('Current Directory:');
            expect(prompt).toContain('Command:');
        });
    });

    describe('_extractCommand', () => {
        it('should extract plain command', () => {
            const command = commandGenerator._extractCommand('ls -la');
            expect(command).toBe('ls -la');
        });

        it('should remove common prefixes', () => {
            const command = commandGenerator._extractCommand('Command: ls -la');
            expect(command).toBe('ls -la');
        });

        it('should handle code block formatting', () => {
            const command = commandGenerator._extractCommand('```bash\nls -la\n```');
            expect(command).toBe('ls -la');
        });

        it('should handle single backticks', () => {
            const command = commandGenerator._extractCommand('`ls -la`');
            expect(command).toBe('ls -la');
        });

        it('should handle null input', () => {
            const command = commandGenerator._extractCommand(null);
            expect(command).toBeNull();
        });

        it('should handle empty string', () => {
            const command = commandGenerator._extractCommand('');
            expect(command).toBeNull();
        });
    });

    describe('_validateCommand', () => {
        it('should validate safe commands', () => {
            const result = commandGenerator._validateCommand('ls -la');
            expect(result.safe).toBe(true);
        });

        it('should reject dangerous rm commands', () => {
            const result = commandGenerator._validateCommand('rm -rf /');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Command contains potentially destructive operations');
        });

        it('should reject sudo rm commands', () => {
            const result = commandGenerator._validateCommand('sudo rm file.txt');
            expect(result.safe).toBe(false);
        });

        it('should reject shutdown commands', () => {
            const result = commandGenerator._validateCommand('shutdown now');
            expect(result.safe).toBe(false);
        });

        it('should reject extremely long commands', () => {
            const longCommand = 'a'.repeat(501);
            const result = commandGenerator._validateCommand(longCommand);
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Command is too long');
        });

        it('should handle null command', () => {
            const result = commandGenerator._validateCommand(null);
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Empty or invalid command');
        });

        it('should handle empty command', () => {
            const result = commandGenerator._validateCommand('');
            expect(result.safe).toBe(false);
            expect(result.reason).toBe('Empty or invalid command');
        });
    });
});
