// tests/unit/commands/rolesCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import RolesCommand from '../../../commands/role/RolesCommand.js';

// Mock logger
vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(),
}));

// Mock SystemMessages
vi.mock('../../../systemMessages.js', () => ({
    default: {
        getAvailableRoles: vi.fn(),
        getLevel: vi.fn(),
        getSystemMessage: vi.fn(),
        getReminder: vi.fn(),
        getExcludedTools: vi.fn(),
    },
}));

describe('RolesCommand', () => {
    let rolesCommand;
    let mockLogger;
    let mockContext;
    let mockSystemMessages;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Create mock logger
        mockLogger = {
            raw: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Setup SystemMessages mock
        mockSystemMessages = (await import('../../../systemMessages.js')).default;
        mockSystemMessages.getAvailableRoles.mockReturnValue(['coder', 'reviewer', 'architect']);
        mockSystemMessages.getLevel.mockImplementation(role => {
            const levels = { coder: 'base', reviewer: 'base', architect: 'smart' };
            return levels[role] || 'base';
        });
        mockSystemMessages.getSystemMessage.mockImplementation(role => {
            const messages = {
                coder: 'You are an expert software developer and coding assistant.',
                reviewer: 'You are a senior code reviewer and quality assurance expert.',
                architect: 'You are a senior software architect and system design expert.',
            };
            return messages[role] || 'You are a helpful assistant.';
        });
        mockSystemMessages.getReminder.mockImplementation(role => {
            const reminders = {
                coder: 'Remember, follow strictly your system prompt most importantly.',
                reviewer: 'Remember to identify bugs and missing elements.',
                architect: 'Remember to use tools to understand context first.',
            };
            return reminders[role] || '';
        });
        mockSystemMessages.getExcludedTools.mockImplementation(role => {
            const excluded = {
                coder: ['get_time', 'calculate'],
                reviewer: ['get_time', 'calculate', 'edit_file', 'write_file'],
                architect: [],
            };
            return excluded[role] || [];
        });

        // Create mock context
        mockContext = {
            apiClient: {
                getCurrentRole: vi.fn().mockReturnValue('coder'),
            },
        };

        // Create RolesCommand instance
        rolesCommand = new RolesCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(rolesCommand.name).toBe('roles');
            expect(rolesCommand.description).toBe('Show available roles and current role');
            expect(rolesCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = rolesCommand.getRequiredDependencies();
            expect(dependencies).toContain('apiClient');
        });
    });

    describe('implementation', () => {
        it('should display all available roles with current role highlighted', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call required SystemMessages methods
            expect(mockSystemMessages.getAvailableRoles).toHaveBeenCalled();
            expect(mockContext.apiClient.getCurrentRole).toHaveBeenCalled();

            // Should display header
            expect(mockLogger.raw).toHaveBeenCalledWith('\n🎭 Available Roles:');
            expect(mockLogger.raw).toHaveBeenCalledWith('─'.repeat(50));

            // Should display current role with crown icon
            expect(mockLogger.raw).toHaveBeenCalledWith('👑 Coder (current)');

            // Should display other roles with regular icon
            expect(mockLogger.raw).toHaveBeenCalledWith('🎭 Reviewer');
            expect(mockLogger.raw).toHaveBeenCalledWith('🎭 Architect');

            // Should display usage tip
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '💡 Use "/role <name>" to switch roles (e.g., "/role reviewer")'
            );
        });

        it('should display role levels with correct icons', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display base level with tool icon
            expect(mockLogger.raw).toHaveBeenCalledWith('   🔧 Model Level: base');

            // Should display smart level with brain icon
            expect(mockLogger.raw).toHaveBeenCalledWith('   🧠 Model Level: smart');
        });

        it('should display system message previews', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display first line of system messages
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '   You are an expert software developer and coding assistant.'
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '   You are a senior code reviewer and quality assurance expert.'
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '   You are a senior software architect and system design expert.'
            );
        });

        it('should display reminder messages', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display reminder messages
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '   💭 Reminder: Remember, follow strictly your system prompt most importantly.'
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '   💭 Reminder: Remember to identify bugs and missing elements.'
            );
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '   💭 Reminder: Remember to use tools to understand context first.'
            );
        });

        it('should display excluded tools', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display excluded tools for roles that have them
            expect(mockLogger.raw).toHaveBeenCalledWith('   🚫 Excludes: get_time, calculate');
            expect(mockLogger.raw).toHaveBeenCalledWith(
                '   🚫 Excludes: get_time, calculate, edit_file...'
            );
        });

        it('should handle role with no excluded tools', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Architect has no excluded tools, so no excludes line should be shown for it
            const excludesCalls = mockLogger.raw.mock.calls.filter(
                call => call[0] && call[0].includes('🚫 Excludes:')
            );

            // Should have excludes for coder and reviewer, but not architect
            expect(excludesCalls.length).toBe(2);
        });

        it('should handle long reminder messages', async () => {
            const longReminder =
                'This is a very long reminder message that exceeds 80 characters and should be truncated with ellipsis';
            mockSystemMessages.getReminder.mockImplementation(role => {
                if (role === 'coder') {
                    return longReminder;
                }
                return 'Short reminder';
            });

            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should truncate long reminders
            const reminderCalls = mockLogger.raw.mock.calls.filter(
                call => call[0] && call[0].includes('💭 Reminder:')
            );

            const truncatedCall = reminderCalls.find(
                call =>
                    call[0].includes('...') &&
                    call[0].includes(
                        'This is a very long reminder message that exceeds 80 characters and should be truncated with ellipsis'.substring(
                            0,
                            80
                        )
                    )
            );
            expect(truncatedCall).toBeDefined();
        });

        it('should handle role with many excluded tools', async () => {
            mockSystemMessages.getExcludedTools.mockReturnValue([
                'tool1',
                'tool2',
                'tool3',
                'tool4',
                'tool5',
            ]);

            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should show only first 3 tools with ellipsis
            expect(mockLogger.raw).toHaveBeenCalledWith('   🚫 Excludes: tool1, tool2, tool3...');
        });

        it('should handle no current role', async () => {
            mockContext.apiClient.getCurrentRole.mockReturnValue(null);

            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // All roles should be displayed with regular icon (no current role)
            const crownCalls = mockLogger.raw.mock.calls.filter(
                call => call[0] && call[0].includes('👑')
            );
            expect(crownCalls).toHaveLength(0);
        });

        it('should handle arguments (ignored)', async () => {
            const result = await rolesCommand.implementation('some args', mockContext);

            expect(result).toBe(true);

            // Args are ignored, should still work
            expect(mockSystemMessages.getAvailableRoles).toHaveBeenCalled();
        });

        it('should handle fast level with lightning icon', async () => {
            mockSystemMessages.getLevel.mockReturnValue('fast');

            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display fast level with lightning icon
            expect(mockLogger.raw).toHaveBeenCalledWith('   ⚡ Model Level: fast');
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = rolesCommand.getUsage();
            expect(usage).toBe('/roles');
        });
    });

    describe('error handling', () => {
        it('should handle SystemMessages errors', async () => {
            mockSystemMessages.getAvailableRoles.mockImplementation(() => {
                throw new Error('SystemMessages error');
            });

            // The command doesn't have error handling, so it will throw
            await expect(rolesCommand.implementation('', mockContext)).rejects.toThrow(
                'SystemMessages error'
            );
        });

        it('should handle missing apiClient', async () => {
            const contextWithoutApiClient = {
                apiClient: null,
            };

            // The command doesn't check for null apiClient, so it will throw
            await expect(
                rolesCommand.implementation('', contextWithoutApiClient)
            ).rejects.toThrow();
        });
    });
});
