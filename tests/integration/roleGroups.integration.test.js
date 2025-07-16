// tests/integration/roleGroups.integration.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SystemMessages from '../../src/core/ai/systemMessages.js';

// Mock process.cwd() to avoid ENOENT errors in test environment
const originalCwd = process.cwd;

describe('Role Groups Integration Test', () => {
    beforeEach(() => {
        // Mock process.cwd() before tests
        process.cwd = vi.fn(() => '/mnt/persist/workspace');

        // Clear any cached instances to ensure fresh loading
        SystemMessages.reloadRoles();
    });

    afterEach(() => {
        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/mnt/persist/workspace');
    });

    describe('File-based group loading', () => {
        it('should load roles from actual files and organize by groups', () => {
            const availableRoles = SystemMessages.getAvailableRoles();
            const availableGroups = SystemMessages.getAvailableGroups();

            // Should have roles from different groups
            expect(availableRoles).toContain('coder'); // from core.json (global)
            expect(availableRoles).toContain('dude'); // from testing-roles.testing.json (testing)
            expect(availableRoles).toContain('customer'); // from grocery-workflow.testing.json (testing)

            // Should have the expected groups
            expect(availableGroups).toContain('global');
            expect(availableGroups).toContain('testing');
        });

        it('should correctly assign roles to groups based on filename', () => {
            const globalRoles = SystemMessages.getRolesByGroup('global');
            const testingRoles = SystemMessages.getRolesByGroup('testing');

            // Global roles (from core.json and other files without group suffix)
            expect(globalRoles).toContain('coder');
            expect(globalRoles).toContain('reviewer');

            // Testing roles (from *.testing.json files)
            expect(testingRoles).toContain('dude');
            expect(testingRoles).toContain('customer');
            expect(testingRoles).toContain('grocery_worker');
        });

        it('should resolve roles correctly with group prefixes', () => {
            // Test resolving global role without prefix
            const coderResult = SystemMessages.resolveRole('coder');
            expect(coderResult.found).toBe(true);
            expect(coderResult.roleName).toBe('coder');
            expect(coderResult.group).toBe('global');

            // Test resolving role with group prefix
            const dudeResult = SystemMessages.resolveRole('testing.dude');
            expect(dudeResult.found).toBe(true);
            expect(dudeResult.roleName).toBe('dude');
            expect(dudeResult.group).toBe('testing');

            // Test resolving another testing role
            const customerResult = SystemMessages.resolveRole('testing.customer');
            expect(customerResult.found).toBe(true);
            expect(customerResult.roleName).toBe('customer');
            expect(customerResult.group).toBe('testing');
        });

        it('should handle role that exists in non-global group when no prefix specified', () => {
            // When no group is specified, should still find the role
            const dudeResult = SystemMessages.resolveRole('dude');
            expect(dudeResult.found).toBe(true);
            expect(dudeResult.roleName).toBe('dude');
            expect(dudeResult.group).toBe('testing'); // Should find it in testing group
        });

        it('should return correct group metadata for roles', () => {
            expect(SystemMessages.getRoleGroup('coder')).toBe('global');
            expect(SystemMessages.getRoleGroup('dude')).toBe('testing');
            expect(SystemMessages.getRoleGroup('customer')).toBe('testing');
        });

        it('should maintain backward compatibility for all role access methods', () => {
            // All existing methods should work regardless of which group the role is in
            expect(SystemMessages.hasRole('coder')).toBe(true);
            expect(SystemMessages.hasRole('dude')).toBe(true);
            expect(SystemMessages.hasRole('customer')).toBe(true);

            expect(SystemMessages.getLevel('coder')).toBe('base');
            expect(SystemMessages.getLevel('dude')).toBe('fast');
            expect(SystemMessages.getLevel('customer')).toBe('fast');

            expect(SystemMessages.getSystemMessage('coder')).toContain('expert software developer');
            expect(SystemMessages.getSystemMessage('dude')).toContain('helpful assistant');
            expect(SystemMessages.getSystemMessage('customer')).toContain('customer at FreshMart');
        });
    });
});
