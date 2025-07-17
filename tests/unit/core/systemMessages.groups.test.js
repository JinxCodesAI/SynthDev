// tests/unit/core/systemMessages.groups.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

// Mock the configuration loader to test group functionality
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        loadConfig: vi.fn(path => {
            if (path === 'defaults/environment-template.json') {
                return {
                    template: 'Test environment',
                };
            }
            return {};
        }),
        loadRolesFromDirectory: vi.fn(dirPath => {
            if (dirPath === 'roles') {
                return {
                    roles: {
                        // Global roles
                        coder: {
                            level: 'base',
                            systemMessage: 'You are a coder',
                            _group: 'global',
                            _source: 'core.json',
                        },
                        reviewer: {
                            level: 'base',
                            systemMessage: 'You are a reviewer',
                            _group: 'global',
                            _source: 'core.json',
                        },
                        // Testing group roles
                        dude: {
                            level: 'fast',
                            systemMessage: 'You are a dude',
                            _group: 'testing',
                            _source: 'testing-roles.testing.json',
                        },
                        tester: {
                            level: 'base',
                            systemMessage: 'You are a tester',
                            _group: 'testing',
                            _source: 'test-roles.testing.json',
                        },
                        // Specialized group roles
                        specialist: {
                            level: 'smart',
                            systemMessage: 'You are a specialist',
                            _group: 'specialized',
                            _source: 'specialist.specialized.json',
                        },
                    },
                    roleGroups: {
                        global: ['coder', 'reviewer'],
                        testing: ['dude', 'tester'],
                        specialized: ['specialist'],
                    },
                };
            }
            return {};
        }),
        clearCache: vi.fn(),
    })),
}));

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

describe('SystemMessages - Group Functionality', () => {
    beforeEach(() => {
        // Mock process.cwd() before tests
        process.cwd = vi.fn(() => '/test/workspace');
        vi.clearAllMocks();
        SystemMessages.reloadRoles();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/test/workspace');
    });

    describe('Group management', () => {
        it('should return available groups', () => {
            const groups = SystemMessages.getAvailableGroups();

            expect(groups).toContain('global');
            expect(groups).toContain('testing');
            expect(groups).toContain('specialized');
            expect(groups.length).toBe(3);
        });

        it('should return roles by group', () => {
            const globalRoles = SystemMessages.getRolesByGroup('global');
            const testingRoles = SystemMessages.getRolesByGroup('testing');
            const specializedRoles = SystemMessages.getRolesByGroup('specialized');

            expect(globalRoles).toEqual(['coder', 'reviewer']);
            expect(testingRoles).toEqual(['dude', 'tester']);
            expect(specializedRoles).toEqual(['specialist']);
        });

        it('should return empty array for unknown group', () => {
            const unknownRoles = SystemMessages.getRolesByGroup('unknown');
            expect(unknownRoles).toEqual([]);
        });

        it('should return correct group for role', () => {
            expect(SystemMessages.getRoleGroup('coder')).toBe('global');
            expect(SystemMessages.getRoleGroup('dude')).toBe('testing');
            expect(SystemMessages.getRoleGroup('specialist')).toBe('specialized');
        });

        it('should return global for unknown role', () => {
            expect(SystemMessages.getRoleGroup('unknown')).toBe('global');
        });
    });

    describe('Role resolution', () => {
        it('should resolve simple role names to global group', () => {
            const result = SystemMessages.resolveRole('coder');

            expect(result.roleName).toBe('coder');
            expect(result.group).toBe('global');
            expect(result.found).toBe(true);
        });

        it('should resolve group.role format', () => {
            const result = SystemMessages.resolveRole('testing.dude');

            expect(result.roleName).toBe('dude');
            expect(result.group).toBe('testing');
            expect(result.found).toBe(true);
        });

        it('should handle unknown role in global group', () => {
            const result = SystemMessages.resolveRole('unknown');

            expect(result.roleName).toBe('unknown');
            expect(result.group).toBe('global');
            expect(result.found).toBe(false);
        });

        it('should handle unknown role in specific group', () => {
            const result = SystemMessages.resolveRole('testing.unknown');

            expect(result.roleName).toBe('unknown');
            expect(result.group).toBe('testing');
            expect(result.found).toBe(false);
        });

        it('should handle role that exists but not in global when no group specified', () => {
            const result = SystemMessages.resolveRole('dude');

            // Should find the role even though it's not in global
            expect(result.roleName).toBe('dude');
            expect(result.group).toBe('testing');
            expect(result.found).toBe(true);
        });
    });

    describe('Backward compatibility', () => {
        it('should maintain existing role access methods', () => {
            // All existing methods should work regardless of groups
            expect(SystemMessages.hasRole('coder')).toBe(true);
            expect(SystemMessages.hasRole('dude')).toBe(true);
            expect(SystemMessages.hasRole('specialist')).toBe(true);

            expect(SystemMessages.getSystemMessage('coder')).toContain('You are a coder');
            expect(SystemMessages.getSystemMessage('dude')).toContain('You are a dude');
            expect(SystemMessages.getSystemMessage('specialist')).toContain('You are a specialist');

            expect(SystemMessages.getLevel('coder')).toBe('base');
            expect(SystemMessages.getLevel('dude')).toBe('fast');
            expect(SystemMessages.getLevel('specialist')).toBe('smart');
        });

        it('should include all roles in getAvailableRoles regardless of group', () => {
            const allRoles = SystemMessages.getAvailableRoles();

            expect(allRoles).toContain('coder');
            expect(allRoles).toContain('reviewer');
            expect(allRoles).toContain('dude');
            expect(allRoles).toContain('tester');
            expect(allRoles).toContain('specialist');
            expect(allRoles.length).toBe(5);
        });
    });
});
