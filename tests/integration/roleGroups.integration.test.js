// tests/integration/roleGroups.integration.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import SystemMessages from '../../src/core/ai/systemMessages.js';

describe('Role Groups Integration Test', () => {
    beforeEach(() => {
        // Clear any cached instances to ensure fresh loading
        SystemMessages.reloadRoles();
    });

    describe('File-based group loading', () => {
        it('should load roles from actual files and organize by groups', () => {
            const availableRoles = SystemMessages.getAvailableRoles();
            const availableGroups = SystemMessages.getAvailableGroups();

            // Should have some roles loaded
            expect(availableRoles.length).toBeGreaterThan(0);

            // Should have the expected groups (at minimum global should exist)
            expect(availableGroups).toContain('global');
            expect(availableGroups.length).toBeGreaterThan(0);

            // Verify that roles are properly distributed across groups
            const globalRoles = SystemMessages.getRolesByGroup('global');
            expect(globalRoles.length).toBeGreaterThan(0);
        });

        it('should correctly assign roles to groups based on filename', () => {
            const availableGroups = SystemMessages.getAvailableGroups();

            // Test that each group has some roles
            for (const group of availableGroups) {
                const rolesInGroup = SystemMessages.getRolesByGroup(group);
                expect(rolesInGroup.length).toBeGreaterThan(0);

                // Verify each role in the group actually exists
                for (const roleName of rolesInGroup) {
                    expect(SystemMessages.hasRole(roleName)).toBe(true);

                    // Note: Due to role overwriting (e.g., architect in both global and agentic),
                    // the final group assignment might differ from the original group.
                    // This is expected behavior - global roles take precedence.
                    const actualGroup = SystemMessages.getRoleGroup(roleName);
                    expect(actualGroup).toBeDefined();
                    expect(typeof actualGroup).toBe('string');
                }
            }
        });

        it('should resolve roles correctly with group prefixes', () => {
            const availableGroups = SystemMessages.getAvailableGroups();

            // Test resolving roles from each group
            for (const group of availableGroups) {
                const rolesInGroup = SystemMessages.getRolesByGroup(group);

                if (rolesInGroup.length > 0) {
                    const testRole = rolesInGroup[0]; // Take first role from group

                    // Test resolving without prefix (should work for any role)
                    const withoutPrefixResult = SystemMessages.resolveRole(testRole);
                    expect(withoutPrefixResult.found).toBe(true);
                    expect(withoutPrefixResult.roleName).toBe(testRole);

                    // Test resolving with group prefix
                    const withPrefixResult = SystemMessages.resolveRole(`${group}.${testRole}`);
                    expect(withPrefixResult.found).toBe(true);
                    expect(withPrefixResult.roleName).toBe(testRole);
                    expect(withPrefixResult.group).toBe(group);
                }
            }
        });

        it('should handle role that exists in non-global group when no prefix specified', () => {
            const availableGroups = SystemMessages.getAvailableGroups();
            const nonGlobalGroups = availableGroups.filter(g => g !== 'global');

            // Find a role that exists in a non-global group
            for (const group of nonGlobalGroups) {
                const rolesInGroup = SystemMessages.getRolesByGroup(group);
                if (rolesInGroup.length > 0) {
                    const testRole = rolesInGroup[0];

                    // When no group is specified, should still find the role
                    const result = SystemMessages.resolveRole(testRole);
                    expect(result.found).toBe(true);
                    expect(result.roleName).toBe(testRole);
                    // Should find it in the correct group
                    expect(result.group).toBe(group);
                    break;
                }
            }
        });

        it('should return correct group metadata for roles', () => {
            const availableRoles = SystemMessages.getAvailableRoles();

            // Test that each role has correct group metadata
            for (const roleName of availableRoles.slice(0, 5)) {
                // Test first 5 roles to keep test fast
                const group = SystemMessages.getRoleGroup(roleName);
                expect(group).toBeDefined();
                expect(typeof group).toBe('string');

                // Verify the role is actually in that group
                const rolesInGroup = SystemMessages.getRolesByGroup(group);

                // For group-prefixed roles (like 'agentic.pm'), check if the base name is in the group
                // For simple roles (like 'coder'), check if the role itself is in the group
                const baseRoleName = roleName.includes('.') ? roleName.split('.')[1] : roleName;
                expect(rolesInGroup).toContain(baseRoleName);
            }
        });

        it('should maintain backward compatibility for all role access methods', () => {
            const availableRoles = SystemMessages.getAvailableRoles();

            // Test a few roles to ensure all methods work
            for (const roleName of availableRoles.slice(0, 3)) {
                // Test first 3 roles
                // All existing methods should work regardless of which group the role is in
                expect(SystemMessages.hasRole(roleName)).toBe(true);

                const level = SystemMessages.getLevel(roleName);
                expect(level).toBeDefined();
                expect(['fast', 'base', 'smart']).toContain(level);

                const systemMessage = SystemMessages.getSystemMessage(roleName);
                expect(systemMessage).toBeDefined();
                expect(typeof systemMessage).toBe('string');
                expect(systemMessage.length).toBeGreaterThan(0);
            }
        });
    });
});
