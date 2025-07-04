// tests/unit/commands/roleCommand.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import RoleCommand from '../../../commands/role/RoleCommand.js';

// Mock logger
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: vi.fn(),
}));

// Mock SystemMessages
vi.mock('../../../systemMessages.js', () => ({
    default: {
        hasRole: vi.fn(),
        getAvailableRoles: vi.fn(),
        getSystemMessage: vi.fn(),
        getExcludedTools: vi.fn(),
        getAvailableGroups: vi.fn(),
        getRolesByGroup: vi.fn(),
        getRoleGroup: vi.fn(),
        resolveRole: vi.fn(),
    },
}));

describe('RoleCommand', () => {
    let roleCommand;
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
        mockSystemMessages = (await import('../../../systemMessages.js')).default;
        mockSystemMessages.hasRole.mockReturnValue(true);
        mockSystemMessages.getAvailableRoles.mockReturnValue(['coder', 'reviewer', 'architect']);
        mockSystemMessages.getSystemMessage.mockReturnValue('You are a helpful assistant.');
        mockSystemMessages.getExcludedTools.mockReturnValue(['get_time', 'calculate']);
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

        // Create mock context
        mockContext = {
            apiClient: {
                getCurrentRole: vi.fn().mockReturnValue('coder'),
                setSystemMessage: vi.fn().mockResolvedValue(true),
                getFilteredToolCount: vi.fn().mockReturnValue(8),
                getTotalToolCount: vi.fn().mockReturnValue(10),
            },
        };

        // Create RoleCommand instance
        roleCommand = new RoleCommand();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(roleCommand.name).toBe('role');
            expect(roleCommand.description).toBe(
                'Switch to a specific role (coder, reviewer, architect)'
            );
            expect(roleCommand.aliases).toEqual([]);
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = roleCommand.getRequiredDependencies();
            expect(dependencies).toContain('apiClient');
        });
    });

    describe('validateArgs', () => {
        it('should return null for valid args', () => {
            const result = roleCommand.validateArgs('coder');
            expect(result).toBeNull();
        });

        it('should return error for empty args', () => {
            const result = roleCommand.validateArgs('');
            expect(result).toBe('Role name is required. Usage: /role <name>');
        });

        it('should return error for null args', () => {
            const result = roleCommand.validateArgs(null);
            expect(result).toBe('Role name is required. Usage: /role <name>');
        });

        it('should return error for whitespace-only args', () => {
            const result = roleCommand.validateArgs('   ');
            expect(result).toBe('Role name is required. Usage: /role <name>');
        });
    });

    describe('implementation', () => {
        it('should switch to valid role successfully', async () => {
            const result = await roleCommand.implementation('reviewer', mockContext);

            expect(result).toBe(true);

            // Should resolve the role
            expect(mockSystemMessages.resolveRole).toHaveBeenCalledWith('reviewer');

            // Should get system message and set it
            expect(mockSystemMessages.getSystemMessage).toHaveBeenCalledWith('reviewer');
            expect(mockContext.apiClient.setSystemMessage).toHaveBeenCalledWith(
                'You are a helpful assistant.',
                'reviewer'
            );

            // Should display success message
            expect(mockLogger.user).toHaveBeenCalledWith(
                "🎭 Role switched from 'coder' to 'reviewer'"
            );

            // Should display tool count
            expect(mockLogger.info).toHaveBeenCalledWith('🔧 Tools: 8/10 available');

            // Should display excluded tools
            expect(mockLogger.info).toHaveBeenCalledWith(
                '🚫 Excluded tools for reviewer: get_time, calculate'
            );
        });

        it('should handle unknown role', async () => {
            mockSystemMessages.resolveRole.mockReturnValue({
                roleName: 'unknown',
                group: 'global',
                found: false,
            });

            const result = await roleCommand.implementation('unknown', mockContext);

            expect(result).toBe(true);

            // Should resolve the role
            expect(mockSystemMessages.resolveRole).toHaveBeenCalledWith('unknown');

            // Should display error messages
            expect(mockLogger.error).toHaveBeenCalledWith('Unknown role: unknown');
            expect(mockLogger.info).toHaveBeenCalledWith(
                '📖 Available global roles: coder, reviewer, architect'
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                '💡 Use /roles to see detailed role information\n'
            );

            // Should not call setSystemMessage
            expect(mockContext.apiClient.setSystemMessage).not.toHaveBeenCalled();
        });

        it('should handle role with no excluded tools', async () => {
            mockSystemMessages.getExcludedTools.mockReturnValue([]);

            const result = await roleCommand.implementation('architect', mockContext);

            expect(result).toBe(true);

            // Should not display excluded tools message
            const excludedToolsCalls = mockLogger.info.mock.calls.filter(
                call => call[0] && call[0].includes('🚫 Excluded tools')
            );
            expect(excludedToolsCalls).toHaveLength(0);
        });

        it('should handle switching from no previous role', async () => {
            mockContext.apiClient.getCurrentRole.mockReturnValue(null);

            const result = await roleCommand.implementation('coder', mockContext);

            expect(result).toBe(true);

            // Should display switch message with 'none' as previous role
            expect(mockLogger.user).toHaveBeenCalledWith("🎭 Role switched from 'none' to 'coder'");
        });

        it('should handle setSystemMessage errors', async () => {
            const error = new Error('Failed to set system message');
            mockContext.apiClient.setSystemMessage.mockRejectedValue(error);

            const result = await roleCommand.implementation('coder', mockContext);

            expect(result).toBe(true);

            // Should log error
            expect(mockLogger.error).toHaveBeenCalledWith(error, 'Error switching role');
        });

        it('should trim role name', async () => {
            const result = await roleCommand.implementation('  coder  ', mockContext);

            expect(result).toBe(true);

            // Should resolve trimmed role name
            expect(mockSystemMessages.resolveRole).toHaveBeenCalledWith('coder');
        });

        it('should handle group-specific role selection', async () => {
            const result = await roleCommand.implementation('testing.dude', mockContext);

            expect(result).toBe(true);

            // Should resolve the group.role specification
            expect(mockSystemMessages.resolveRole).toHaveBeenCalledWith('testing.dude');

            // Should get system message and set it
            expect(mockSystemMessages.getSystemMessage).toHaveBeenCalledWith('dude');
            expect(mockContext.apiClient.setSystemMessage).toHaveBeenCalledWith(
                'You are a helpful assistant.',
                'dude'
            );

            // Should display success message with group info
            expect(mockLogger.user).toHaveBeenCalledWith(
                "🎭 Role switched from 'coder' to 'dude' [testing]"
            );
        });

        it('should handle unknown group.role combination', async () => {
            mockSystemMessages.resolveRole.mockReturnValue({
                roleName: 'unknown',
                group: 'testing',
                found: false,
            });

            const result = await roleCommand.implementation('testing.unknown', mockContext);

            expect(result).toBe(true);

            // Should display error for unknown role in group
            expect(mockLogger.error).toHaveBeenCalledWith('Unknown role: testing.unknown');
            expect(mockLogger.info).toHaveBeenCalledWith("📖 Available roles in 'testing': dude");
        });
    });

    describe('getUsage', () => {
        it('should return correct usage string', () => {
            const usage = roleCommand.getUsage();
            expect(usage).toBe('/role <name>');
        });
    });

    describe('getHelp', () => {
        it('should return help text with global roles and groups', () => {
            const help = roleCommand.getHelp();

            expect(help).toContain('Global roles: coder, reviewer, architect');
            expect(help).toContain('Groups: testing');
            expect(help).toContain('Examples: /role coder, /role testing.dude');
        });
    });

    describe('error handling', () => {
        it('should handle SystemMessages errors', async () => {
            mockSystemMessages.resolveRole.mockImplementation(() => {
                throw new Error('SystemMessages error');
            });

            const result = await roleCommand.implementation('coder', mockContext);

            expect(result).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'Error switching role'
            );
        });

        it('should handle missing apiClient', async () => {
            const contextWithoutApiClient = {
                apiClient: null,
            };

            const result = await roleCommand.implementation('coder', contextWithoutApiClient);

            expect(result).toBe(true);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});
