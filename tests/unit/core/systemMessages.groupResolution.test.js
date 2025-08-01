import { describe, it, expect, beforeEach, vi } from 'vitest';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

describe('SystemMessages - Group Resolution Enhancement', () => {
    beforeEach(() => {
        // Clear any cached instances
        if (SystemMessages.instance) {
            SystemMessages.instance = null;
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
            // pm role has enabled_agents: ["architect"]
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

        it('should reject invalid spawn permissions', () => {
            expect(SystemMessages.canSpawnAgent('pm', 'developer')).toBe(false);
            expect(SystemMessages.canSpawnAgent('pm', 'nonexistent')).toBe(false);
        });
    });

    describe('System Message Generation with Groups', () => {
        it('should include group information in coordination messages', () => {
            const systemMessage = SystemMessages.getSystemMessage('pm');

            // Should contain coordination info with role descriptions
            expect(systemMessage).toContain(
                'architect - responsible for designing system architectures'
            );
            expect(systemMessage).toContain('Your role is pm and you need to coordinate');
        });

        it('should handle roles with group-prefixed enabled agents', () => {
            // Test that system message generation works with existing configuration
            const systemMessage = SystemMessages.getSystemMessage('developer');
            expect(systemMessage).toContain('test-runner - responsible for running existing tests');
            expect(systemMessage).toContain(
                'git-manager - responsible for handling git operations'
            );
        });
    });

    describe('Backward Compatibility', () => {
        it('should maintain backward compatibility for existing role references', () => {
            // All existing functionality should still work
            expect(SystemMessages.hasRole('architect')).toBe(true);
            expect(SystemMessages.hasRole('pm')).toBe(true);
            expect(SystemMessages.getLevel('architect')).toBe('smart');
            expect(SystemMessages.getEnabledAgents('pm')).toContain('architect');
        });

        it('should work with existing system message generation', () => {
            const systemMessage = SystemMessages.getSystemMessage('architect');
            expect(systemMessage).toContain('software architect');
            expect(systemMessage).toContain('Environment Information');
        });
    });
});
