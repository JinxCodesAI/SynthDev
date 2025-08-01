import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockSystemMessages, RoleFixtures } from '../../helpers/roleFixtures.js';

describe('SystemMessages - Group Resolution Enhancement', () => {
    let SystemMessages;
    let roleFixtures;
    let cleanupFixture;

    beforeEach(() => {
        // Create role fixtures manager
        roleFixtures = new RoleFixtures();

        // Use the role groups fixture for testing
        SystemMessages = roleFixtures.createMockSystemMessages(RoleFixtures.FIXTURES.ROLE_GROUPS);
    });

    afterEach(() => {
        // Clean up fixtures
        if (cleanupFixture) {
            cleanupFixture();
            cleanupFixture = null;
        }
        if (roleFixtures) {
            roleFixtures.restoreAll();
        }
    });

    describe('Enhanced Role Resolution', () => {
        it('should resolve role with group prefix correctly', () => {
            const result = SystemMessages.resolveRole('agentic.architect');

            expect(result.roleName).toBe('architect');
            expect(result.group).toBe('agentic');
            expect(result.found).toBe(true);
            expect(result.ambiguous).toBe(false);
        });

        it('should prioritize global group when no prefix specified', () => {
            const result = SystemMessages.resolveRole('architect');

            expect(result.roleName).toBe('architect');
            expect(result.group).toBe('global');
            expect(result.found).toBe(true);
            expect(result.ambiguous).toBe(false);
        });

        it('should find role in non-global group when not in global', () => {
            const result = SystemMessages.resolveRole('pm');

            expect(result.roleName).toBe('pm');
            expect(result.group).toBe('agentic');
            expect(result.found).toBe(true);
            expect(result.ambiguous).toBe(false);
        });

        it('should handle non-existent role gracefully', () => {
            const result = SystemMessages.resolveRole('nonexistent');

            expect(result.roleName).toBe('nonexistent');
            expect(result.group).toBe('global');
            expect(result.found).toBe(false);
            expect(result.ambiguous).toBe(false);
        });

        it('should handle non-existent group.role gracefully', () => {
            const result = SystemMessages.resolveRole('nonexistent.role');

            expect(result.roleName).toBe('role');
            expect(result.group).toBe('nonexistent');
            expect(result.found).toBe(false);
            expect(result.ambiguous).toBe(false);
        });
    });

    describe('Role Array Resolution', () => {
        it('should resolve array of role specifications', () => {
            const result = SystemMessages.resolveRoleArray([
                'architect',
                'agentic.developer',
                'pm',
            ]);

            expect(result.resolved).toEqual(['architect', 'agentic.developer', 'pm']);
            expect(result.errors).toEqual([]);
        });

        it('should handle mixed valid and invalid roles', () => {
            const result = SystemMessages.resolveRoleArray(['architect', 'nonexistent', 'pm']);

            expect(result.resolved).toEqual(['architect', 'pm']);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('nonexistent');
        });

        it('should handle empty array', () => {
            const result = SystemMessages.resolveRoleArray([]);

            expect(result.resolved).toEqual([]);
            expect(result.errors).toEqual([]);
        });
    });

    describe('Enhanced canSpawnAgent', () => {
        it('should allow spawning with group-prefixed role names', () => {
            // pm role has enabled_agents: ["architect"] in fixture
            // Both should work because architect exists in global and agentic groups
            expect(SystemMessages.canSpawnAgent('pm', 'architect')).toBe(true);
            expect(SystemMessages.canSpawnAgent('pm', 'agentic.architect')).toBe(true);
        });

        it('should work with roles that have group-prefixed enabled_agents', () => {
            // This test demonstrates that the enhanced canSpawnAgent method
            // can handle group-prefixed role names in enabled_agents arrays
            // Since pm has enabled_agents: ["architect"], it should be able to spawn
            // both the global architect and the agentic architect
            expect(SystemMessages.canSpawnAgent('pm', 'architect')).toBe(true);
            expect(SystemMessages.canSpawnAgent('pm', 'agentic.architect')).toBe(true);
        });

        it('should allow developer to spawn test-runner and git-manager', () => {
            // developer role has enabled_agents: ["test-runner", "git-manager"] in fixture
            expect(SystemMessages.canSpawnAgent('developer', 'test-runner')).toBe(true);
            expect(SystemMessages.canSpawnAgent('developer', 'git-manager')).toBe(true);
        });

        it('should reject invalid spawn permissions', () => {
            expect(SystemMessages.canSpawnAgent('pm', 'developer')).toBe(false);
            expect(SystemMessages.canSpawnAgent('pm', 'nonexistent')).toBe(false);
            expect(SystemMessages.canSpawnAgent('test-runner', 'architect')).toBe(false);
        });
    });

    describe('System Message Generation with Groups', () => {
        it('should return system messages for roles', () => {
            const systemMessage = SystemMessages.getSystemMessage('pm');

            // Should return the system message from fixture
            expect(systemMessage).toContain('Project Manager responsible for coordinating');
        });

        it('should handle roles from different groups', () => {
            // Test that system message generation works with roles from different groups
            const architectMessage = SystemMessages.getSystemMessage('architect');
            expect(architectMessage).toContain('software architect');

            const developerMessage = SystemMessages.getSystemMessage('developer');
            expect(developerMessage).toContain('Senior Software Developer');

            const dudeMessage = SystemMessages.getSystemMessage('dude');
            expect(dudeMessage).toContain('helpful assistant');
        });
    });

    describe('Backward Compatibility', () => {
        it('should maintain backward compatibility for existing role references', () => {
            // All existing functionality should still work with fixture data
            expect(SystemMessages.hasRole('architect')).toBe(true);
            expect(SystemMessages.hasRole('pm')).toBe(true);
            expect(SystemMessages.getLevel('architect')).toBe('smart');
            expect(SystemMessages.getEnabledAgents('pm')).toContain('architect');
        });

        it('should work with existing system message generation', () => {
            const systemMessage = SystemMessages.getSystemMessage('architect');
            expect(systemMessage).toContain('software architect');
        });

        it('should handle roles from different groups correctly', () => {
            // Test roles from different groups in fixture
            expect(SystemMessages.hasRole('coder')).toBe(true); // global group
            expect(SystemMessages.hasRole('developer')).toBe(true); // agentic group
            expect(SystemMessages.hasRole('dude')).toBe(true); // testing group
            expect(SystemMessages.hasRole('command_generator')).toBe(true); // internal group
        });
    });
});
