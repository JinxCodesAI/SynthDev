/**
 * Tests for RolesCommand
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RolesCommand } from '../../../src/commands/role/RolesCommand.js';
import SystemMessages from '../../../src/core/ai/systemMessages.js';
import { getLogger } from '../../../src/core/managers/logger.js';

// Mock dependencies
const mockLogger = {
    user: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    raw: vi.fn(),
};

const mockSystemMessages = {
    getAvailableGroups: vi.fn(),
    getRolesByGroup: vi.fn(),
    getAvailableRoles: vi.fn(),
    getRoleGroup: vi.fn(),
    getLevel: vi.fn(),
    getSystemMessage: vi.fn(),
    getReminder: vi.fn(),
    getExcludedTools: vi.fn(),
};

const mockApiClient = {
    getCurrentRole: vi.fn(),
};

const mockContext = {
    apiClient: mockApiClient,
};

// Create a single logger mock instance
const mockLoggerInstance = {
    user: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    raw: vi.fn(),
};

// Mock the logger module
vi.mock('../../../src/core/managers/logger.js', () => ({
    getLogger: () => mockLoggerInstance,
}));

// Mock SystemMessages
vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: {
        getAvailableGroups: vi.fn(),
        getRolesByGroup: vi.fn(),
        getAvailableRoles: vi.fn(),
        getRoleGroup: vi.fn(),
        getLevel: vi.fn(),
        getSystemMessage: vi.fn(),
        getReminder: vi.fn(),
        getExcludedTools: vi.fn(),
    },
}));

describe('RolesCommand', () => {
    let rolesCommand;

    beforeEach(() => {
        rolesCommand = new RolesCommand();
        vi.clearAllMocks();

        // Setup default mock returns
        SystemMessages.getAvailableGroups.mockReturnValue(['global', 'testing']);
        SystemMessages.getRolesByGroup.mockImplementation(group => {
            if (group === 'global') {
                return ['coder', 'reviewer', 'architect'];
            }
            if (group === 'testing') {
                return ['dude'];
            }
            return [];
        });
        SystemMessages.getAvailableRoles.mockReturnValue([
            'coder',
            'reviewer',
            'architect',
            'dude',
        ]);
        SystemMessages.getRoleGroup.mockImplementation(role => {
            if (['coder', 'reviewer', 'architect'].includes(role)) {
                return 'global';
            }
            if (role === 'dude') {
                return 'testing';
            }
            return 'global';
        });
        SystemMessages.getLevel.mockImplementation(role => {
            if (role === 'coder') {
                return 'base';
            }
            if (role === 'reviewer') {
                return 'base';
            }
            if (role === 'architect') {
                return 'smart';
            }
            if (role === 'dude') {
                return 'base';
            }
            return 'base';
        });
        SystemMessages.getSystemMessage.mockImplementation(role => {
            if (role === 'coder') {
                return 'You are an expert software developer and coding assistant.';
            }
            return `System message for ${role}`;
        });
        SystemMessages.getReminder.mockImplementation(role => {
            if (role === 'coder') {
                return 'Remember, follow strictly your system prompt most importantly.';
            }
            return null;
        });
        SystemMessages.getExcludedTools.mockImplementation(role => {
            if (role === 'coder') {
                return ['get_time', 'calculate'];
            }
            if (role === 'reviewer') {
                return ['get_time', 'calculate', 'edit_file'];
            }
            return [];
        });
        mockApiClient.getCurrentRole.mockReturnValue('coder');
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(rolesCommand.name).toBe('roles');
            expect(rolesCommand.description).toBe('Show available roles and current role');
        });
    });

    describe('getRequiredDependencies', () => {
        it('should return required dependencies', () => {
            const dependencies = rolesCommand.getRequiredDependencies();
            expect(dependencies).toEqual(['apiClient']);
            expect(dependencies).toContain('apiClient');
        });
    });

    describe('implementation', () => {
        it('should display group overview by default', async () => {
            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);

            // Should call required SystemMessages methods
            expect(SystemMessages.getAvailableGroups).toHaveBeenCalled();
            expect(mockContext.apiClient.getCurrentRole).toHaveBeenCalled();

            // Should display header for group overview
            expect(mockLoggerInstance.user).toHaveBeenCalledWith('🎭 Available Role Groups:');
            expect(mockLoggerInstance.user).toHaveBeenCalledWith('─'.repeat(50));

            // Should display groups with role counts
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('🌍 global (3 roles)');
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('🧪 testing (1 role)');

            // Should display roles in compact format with current role highlighted
            expect(mockLoggerInstance.info).toHaveBeenCalledWith(
                '   👑 coder, 🔧 reviewer, 🧠 architect'
            );
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('   🔧 dude');

            // Should display usage tips
            expect(mockLoggerInstance.info).toHaveBeenCalledWith(
                '💡 Use "/role <name>" to switch roles (e.g., "/role coder")'
            );
            expect(mockLoggerInstance.info).toHaveBeenCalledWith(
                '💡 Use "/roles <group>" to see detailed information for a specific group'
            );
        });

        it('should display detailed roles from specific group when group is specified', async () => {
            const result = await rolesCommand.implementation('testing', mockContext);

            expect(result).toBe(true);

            // Should call required SystemMessages methods
            expect(SystemMessages.getRolesByGroup).toHaveBeenCalledWith('testing');

            // Should display header for the specific group
            expect(mockLoggerInstance.user).toHaveBeenCalledWith(
                '🧪 testing Group Roles (1 role):'
            );

            // Should display roles from testing group with detailed info
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('🎭 dude');
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('   🔧 Model Level: base');
        });

        it('should display all roles when "all" is specified', async () => {
            const result = await rolesCommand.implementation('all', mockContext);

            expect(result).toBe(true);

            // Should call required SystemMessages methods
            expect(SystemMessages.getAvailableRoles).toHaveBeenCalled();

            // Should display header for all roles
            expect(mockLoggerInstance.user).toHaveBeenCalledWith('🎭 All Available Roles:');

            // Should display roles with group prefixes
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('👑 coder (current)');
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('🎭 reviewer');
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('🎭 architect');
            expect(mockLoggerInstance.info).toHaveBeenCalledWith('🎭 testing.dude');
        });

        it('should handle unknown group gracefully', async () => {
            const result = await rolesCommand.implementation('unknown', mockContext);

            expect(result).toBe(true);

            // Should display error message
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                "No roles found in group 'unknown'"
            );
            expect(mockLoggerInstance.info).toHaveBeenCalledWith(
                '📖 Available groups: global, testing'
            );
        });

        it('should handle no current role', async () => {
            mockApiClient.getCurrentRole.mockReturnValue(null);

            const result = await rolesCommand.implementation('', mockContext);

            expect(result).toBe(true);
            // Should still work without current role highlighting
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
            SystemMessages.getAvailableGroups.mockImplementation(() => {
                throw new Error('SystemMessages error');
            });

            await expect(rolesCommand.implementation('', mockContext)).rejects.toThrow(
                'SystemMessages error'
            );
        });

        it('should handle missing apiClient', async () => {
            const contextWithoutApiClient = {};

            await expect(
                rolesCommand.implementation('', contextWithoutApiClient)
            ).rejects.toThrow();
        });
    });
});
