// tests/unit/commands/rolesCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import RolesCommand from '../../../src/commands/role/RolesCommand.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

// Mock SystemMessages
vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        getAvailableRoles: vi.fn(),
        getLevel: vi.fn(),
        getSystemMessage: vi.fn(),
        getReminder: vi.fn(),
        getExcludedTools: vi.fn(),
        getAvailableGroups: vi.fn(),
        getRolesByGroup: vi.fn(),
        getRoleGroup: vi.fn(),
        resolveRole: vi.fn(),
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
            user: vi.fn(),
        };

        // Setup logger mock
        const { getLogger } = await import('../../../src/core/managers/logger.js');
        getLogger.mockReturnValue(mockLogger);

        // Setup SystemMessages mock
        mockSystemMessages = (await import('../../../src/core/ai/systemMessages.js')).default;
        mockSystemMessages.getAvailableRoles.mockReturnValue(['coder', 'reviewer', 'architect']);
        mockSystemMessages.getAvailableGroups.mockReturnValue(['global', 'testing']);
        mockSystemMessages.getRolesByGroup.mockImplementation(group => {
            const rolesByGroup = {
                global: ['coder', 'reviewer', 'architect'],
                testing: ['dude'],
            };
            return rolesByGroup[group] || [];
        });
        mockSystemMessages.getRoleGroup.mockImplementation(role => {
            const roleGroups = {
                coder: 'global',
                reviewer: 'global',
                architect: 'global',
                dude: 'testing',
            };
            return roleGroups[role] || 'global';
        });
        mockSystemMessages.resolveRole.mockImplementation(roleSpec => {
            if (roleSpec.includes('.')) {
                const [group, roleName] = roleSpec.split('.', 2);
                const rolesInGroup = mockSystemMessages.getRolesByGroup(group);
                return {
                    roleName,
                    group,
                    found: rolesInGroup.includes(roleName),
                };
            } else {
                const globalRoles = mockSystemMessages.getRolesByGroup('global');
                return {
                    roleName: roleSpec,
                    group: 'global',
                    found: globalRoles.includes(roleSpec),
                };
            }
        });
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
        it('should display global roles by default with current role highlighted', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call required SystemMessages methods
            expect(mockSystemMessages.getRolesByGroup).toHaveBeenCalledWith('global');
            expect(mockContext.apiClient.getCurrentRole).toHaveBeenCalled();

            // Should display header for global roles
            expect(mockLogger.user).toHaveBeenCalledWith('🎭 Available Roles (Global):');
            expect(mockLogger.user).toHaveBeenCalledWith('─'.repeat(50));

            // Should display current role with crown icon
            expect(mockLogger.info).toHaveBeenCalledWith('👑 coder (current)');

            // Should display other roles with regular icon
            expect(mockLogger.info).toHaveBeenCalledWith('🎭 reviewer');
            expect(mockLogger.info).toHaveBeenCalledWith('🎭 architect');

            // Should display usage tips
            expect(mockLogger.info).toHaveBeenCalledWith(
                '💡 Use "/role <name>" to switch roles (e.g., "/role coder")'
            );
        });

        it('should display role levels with correct icons', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display base level with tool icon
            expect(mockLogger.info).toHaveBeenCalledWith('   🔧 Model Level: base');

            // Should display smart level with brain icon
            expect(mockLogger.info).toHaveBeenCalledWith('   🧠 Model Level: smart');
        });

        it('should display system message previews', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display first line of system messages
            expect(mockLogger.info).toHaveBeenCalledWith(
                '   You are an expert software developer and coding assistant.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '   You are a senior code reviewer and quality assurance expert.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '   You are a senior software architect and system design expert.'
            );
        });

        it('should display reminder messages', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display reminder messages
            expect(mockLogger.info).toHaveBeenCalledWith(
                '   💭 Reminder: Remember, follow strictly your system prompt most importantly.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '   💭 Reminder: Remember to identify bugs and missing elements.'
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '   💭 Reminder: Remember to use tools to understand context first.'
            );
        });

        it('should display excluded tools', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display excluded tools for roles that have them
            expect(mockLogger.info).toHaveBeenCalledWith('   🚫 Excludes: get_time, calculate');
            expect(mockLogger.info).toHaveBeenCalledWith(
                '   🚫 Excludes: get_time, calculate, edit_file...'
            );
        });

        it('should handle role with no excluded tools', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Architect has no excluded tools, so no excludes line should be shown for it
            const excludesCalls = mockLogger.info.mock.calls.filter(
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
            const reminderCalls = mockLogger.info.mock.calls.filter(
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
            expect(mockLogger.info).toHaveBeenCalledWith('   🚫 Excludes: tool1, tool2, tool3...');
        });

        it('should handle no current role', async () => {
            mockContext.apiClient.getCurrentRole.mockReturnValue(null);

            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // All roles should be displayed with regular icon (no current role)
            const crownCalls = mockLogger.info.mock.calls.filter(
                call => call[0] && call[0].includes('👑')
            );
            expect(crownCalls).toHaveLength(0);
        });

        it('should handle arguments as group filter', async () => {
            const result = await rolesCommand.implementation('testing', mockContext);

            expect(result).toBe(true);

            // Args are used as group filter
            expect(mockSystemMessages.getRolesByGroup).toHaveBeenCalledWith('testing');
        });

        it('should handle fast level with lightning icon', async () => {
            mockSystemMessages.getLevel.mockReturnValue('fast');

            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should display fast level with lightning icon
            expect(mockLogger.info).toHaveBeenCalledWith('   ⚡ Model Level: fast');
        });

        it('should display roles from specific group when group is specified', async () => {
            const result = await rolesCommand.implementation('testing', mockContext);

            expect(result).toBe(true);

            // Should call getRolesByGroup with the specified group
            expect(mockSystemMessages.getRolesByGroup).toHaveBeenCalledWith('testing');

            // Should display header for the specific group
            expect(mockLogger.user).toHaveBeenCalledWith('🎭 Available Roles (testing):');

            // Should display roles from testing group
            expect(mockLogger.info).toHaveBeenCalledWith('🎭 testing.dude');
        });

        it('should display all roles when "all" is specified', async () => {
            const result = await rolesCommand.implementation('all', mockContext);

            expect(result).toBe(true);

            // Should call getAvailableRoles for all roles
            expect(mockSystemMessages.getAvailableRoles).toHaveBeenCalled();

            // Should display header for all roles
            expect(mockLogger.user).toHaveBeenCalledWith('🎭 All Available Roles:');
        });

        it('should handle unknown group gracefully', async () => {
            mockSystemMessages.getRolesByGroup.mockReturnValue([]);

            const result = await rolesCommand.implementation('unknown', mockContext);

            expect(result).toBe(true);

            // Should display error for unknown group
            expect(mockLogger.error).toHaveBeenCalledWith('No roles found in group \'unknown\'');
            expect(mockLogger.info).toHaveBeenCalledWith('📖 Available groups: global, testing');
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
            mockSystemMessages.getRolesByGroup.mockImplementation(() => {
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
