import { describe, it, expect, beforeEach, vi } from 'vitest';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

describe('SystemMessages - Real Configuration Loading', () => {
    beforeEach(() => {
        // Clear any cached instances
        vi.clearAllMocks();
    });

    describe('Agent Description Loading from Real Config', () => {
        it('should load agent_description from team-roles.agentic.json correctly', () => {
            const systemMessage = SystemMessages.getSystemMessage('pm');

            // The system message should contain the architect's description from the config file
            expect(systemMessage).toContain(
                'architect - responsible for designing system architectures'
            );

            // Should not contain "No description available" for architect
            expect(systemMessage).not.toContain('architect - No description available');
        });

        it('should load all agent descriptions from agentic roles correctly', () => {
            const systemMessage = SystemMessages.getSystemMessage('architect');

            // The system message should contain the developer's description
            expect(systemMessage).toContain('developer - responsible for implementing features');

            // Should not contain "No description available" for developer
            expect(systemMessage).not.toContain('developer - No description available');
        });

        it('should handle pm role with architect coordination', () => {
            const systemMessage = SystemMessages.getSystemMessage('pm');

            console.log('PM System Message:', systemMessage);

            // Should contain coordination info
            expect(systemMessage).toContain(
                'Your role is pm and you need to coordinate with other roles'
            );
            expect(systemMessage).toContain('architect');

            // Should contain proper architect description
            expect(systemMessage).toContain(
                'architect - responsible for designing system architectures'
            );
        });

        it('should handle architect role with developer coordination', () => {
            const systemMessage = SystemMessages.getSystemMessage('architect');

            console.log('Architect System Message:', systemMessage);

            // Should contain coordination info
            expect(systemMessage).toContain(
                'Your role is architect and you need to coordinate with other roles'
            );
            expect(systemMessage).toContain('developer');

            // Should contain proper developer description
            expect(systemMessage).toContain('developer - responsible for implementing features');
        });

        it('should handle developer role with test-runner and git-manager coordination', () => {
            const systemMessage = SystemMessages.getSystemMessage('developer');

            console.log('Developer System Message:', systemMessage);

            // Should contain coordination info
            expect(systemMessage).toContain(
                'Your role is developer and you need to coordinate with other roles'
            );
            expect(systemMessage).toContain('test-runner');
            expect(systemMessage).toContain('git-manager');

            // Should contain proper descriptions
            expect(systemMessage).toContain('test-runner - responsible for running existing tests');
            expect(systemMessage).toContain(
                'git-manager - responsible for handling git operations'
            );
        });
    });

    describe('Debug Role Loading', () => {
        it('should show what roles are actually loaded', () => {
            const instance = new SystemMessages();
            const roles = instance.roles;

            console.log('Loaded roles:', Object.keys(roles));
            console.log('PM role config:', roles.pm);
            console.log('Architect role config:', roles.architect);
            console.log('Developer role config:', roles.developer);
        });
    });
});
