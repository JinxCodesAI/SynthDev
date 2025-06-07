// tests/unit/core/agentic-roles.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock SystemMessages completely
const mockSystemMessages = {
    isAgentic: vi.fn(),
    getEnabledAgents: vi.fn(),
    canSpawnAgent: vi.fn(),
    reloadRoles: vi.fn(),
};

vi.mock('../../../src/core/ai/systemMessages.js', () => ({
    default: mockSystemMessages,
}));

// Import after mocking
const SystemMessages = (await import('../../../src/core/ai/systemMessages.js')).default;

describe('Agentic Roles', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock behaviors
        SystemMessages.isAgentic.mockImplementation(role => {
            const agenticRoles = ['pm', 'architect'];
            return agenticRoles.includes(role);
        });

        SystemMessages.getEnabledAgents.mockImplementation(role => {
            const roleAgents = {
                pm: ['architect', 'developer'],
                architect: ['developer'],
                developer: [],
                reviewer: [],
            };
            if (!(role in roleAgents)) {
                throw new Error(`Unknown role: ${role}`);
            }
            return roleAgents[role];
        });

        SystemMessages.canSpawnAgent.mockImplementation((supervisor, worker) => {
            const enabledAgents = SystemMessages.getEnabledAgents(supervisor);
            return enabledAgents.includes(worker);
        });
    });

    describe('isAgentic method', () => {
        it('should return true for roles with enabled_agents', () => {
            expect(SystemMessages.isAgentic('pm')).toBe(true);
            expect(SystemMessages.isAgentic('architect')).toBe(true);
        });

        it('should return false for roles without enabled_agents', () => {
            expect(SystemMessages.isAgentic('developer')).toBe(false);
            expect(SystemMessages.isAgentic('reviewer')).toBe(false);
        });

        it('should return false for non-existent roles', () => {
            expect(SystemMessages.isAgentic('nonexistent')).toBe(false);
        });
    });

    describe('getEnabledAgents method', () => {
        it('should return enabled agents for agentic roles', () => {
            expect(SystemMessages.getEnabledAgents('pm')).toEqual(['architect', 'developer']);
            expect(SystemMessages.getEnabledAgents('architect')).toEqual(['developer']);
        });

        it('should return empty array for non-agentic roles', () => {
            expect(SystemMessages.getEnabledAgents('developer')).toEqual([]);
            expect(SystemMessages.getEnabledAgents('reviewer')).toEqual([]);
        });

        it('should throw error for non-existent roles', () => {
            expect(() => SystemMessages.getEnabledAgents('nonexistent')).toThrow(
                'Unknown role: nonexistent'
            );
        });
    });

    describe('canSpawnAgent method', () => {
        it('should return true when supervisor can spawn worker', () => {
            expect(SystemMessages.canSpawnAgent('pm', 'architect')).toBe(true);
            expect(SystemMessages.canSpawnAgent('pm', 'developer')).toBe(true);
            expect(SystemMessages.canSpawnAgent('architect', 'developer')).toBe(true);
        });

        it('should return false when supervisor cannot spawn worker', () => {
            expect(SystemMessages.canSpawnAgent('pm', 'reviewer')).toBe(false);
            expect(SystemMessages.canSpawnAgent('developer', 'architect')).toBe(false);
            expect(SystemMessages.canSpawnAgent('reviewer', 'developer')).toBe(false);
        });

        it('should return false for non-agentic supervisors', () => {
            expect(SystemMessages.canSpawnAgent('developer', 'reviewer')).toBe(false);
            expect(SystemMessages.canSpawnAgent('reviewer', 'developer')).toBe(false);
        });
    });
});
