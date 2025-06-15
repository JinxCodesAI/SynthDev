// tests/unit/core/systemMessages.multifile.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SystemMessages from '../../../systemMessages.js';

// Mock the configuration loader to simulate multi-file loading
vi.mock('../../../configurationLoader.js', () => ({
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
                // Simulate loading from multiple files
                return {
                    // From roles.json (legacy)
                    coder: {
                        level: 'base',
                        systemMessage: 'You are a coder',
                        excludedTools: ['get_time'],
                    },
                    reviewer: {
                        level: 'base',
                        systemMessage: 'You are a reviewer',
                        excludedTools: ['edit_file', 'write_file'],
                    },
                    // From core-roles.json
                    basic_assistant: {
                        level: 'fast',
                        systemMessage: 'You are a basic assistant',
                        excludedTools: ['edit_file', 'write_file', 'execute_terminal'],
                    },
                    research_assistant: {
                        level: 'base',
                        systemMessage: 'You are a research assistant',
                        includedTools: ['read_file', 'list_directory', 'exact_search'],
                    },
                    // From specialized/testing-roles.json
                    test_writer: {
                        level: 'base',
                        systemMessage: 'You are a test writer',
                        excludedTools: ['execute_terminal'],
                    },
                    qa_specialist: {
                        level: 'base',
                        systemMessage: 'You are a QA specialist',
                        includedTools: ['read_file', 'list_directory', 'exact_search'],
                    },
                };
            }
            return {};
        }),
        clearCache: vi.fn(),
    })),
}));

describe('SystemMessages - Multi-file Role Loading', () => {
    beforeEach(() => {
        // Clear any cached instances
        vi.clearAllMocks();
        SystemMessages.reloadRoles();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Multi-file role loading', () => {
        it('should load roles from multiple files', () => {
            const availableRoles = SystemMessages.getAvailableRoles();

            // Should include roles from all files
            expect(availableRoles).toContain('coder'); // from roles.json
            expect(availableRoles).toContain('reviewer'); // from roles.json
            expect(availableRoles).toContain('basic_assistant'); // from core-roles.json
            expect(availableRoles).toContain('research_assistant'); // from core-roles.json
            expect(availableRoles).toContain('test_writer'); // from specialized/testing-roles.json
            expect(availableRoles).toContain('qa_specialist'); // from specialized/testing-roles.json

            expect(availableRoles.length).toBe(6);
        });

        it('should correctly load system messages from different files', () => {
            expect(SystemMessages.getSystemMessage('coder')).toContain('You are a coder');
            expect(SystemMessages.getSystemMessage('basic_assistant')).toContain(
                'You are a basic assistant'
            );
            expect(SystemMessages.getSystemMessage('test_writer')).toContain(
                'You are a test writer'
            );
        });

        it('should correctly handle excludedTools from different files', () => {
            expect(SystemMessages.getExcludedTools('coder')).toEqual(['get_time']);
            expect(SystemMessages.getExcludedTools('reviewer')).toEqual([
                'edit_file',
                'write_file',
            ]);
            expect(SystemMessages.getExcludedTools('basic_assistant')).toEqual([
                'edit_file',
                'write_file',
                'execute_terminal',
            ]);
        });

        it('should correctly handle includedTools from different files', () => {
            expect(SystemMessages.getIncludedTools('research_assistant')).toEqual([
                'read_file',
                'list_directory',
                'exact_search',
            ]);
            expect(SystemMessages.getIncludedTools('qa_specialist')).toEqual([
                'read_file',
                'list_directory',
                'exact_search',
            ]);
            expect(SystemMessages.getIncludedTools('coder')).toEqual([]); // No includedTools specified
        });

        it('should correctly identify role existence across all files', () => {
            expect(SystemMessages.hasRole('coder')).toBe(true);
            expect(SystemMessages.hasRole('basic_assistant')).toBe(true);
            expect(SystemMessages.hasRole('test_writer')).toBe(true);
            expect(SystemMessages.hasRole('nonexistent_role')).toBe(false);
        });

        it('should get correct role levels from different files', () => {
            expect(SystemMessages.getLevel('coder')).toBe('base');
            expect(SystemMessages.getLevel('basic_assistant')).toBe('fast');
            expect(SystemMessages.getLevel('test_writer')).toBe('base');
        });
    });

    describe('Backward compatibility', () => {
        it('should maintain compatibility with existing role access methods', () => {
            // Test that all existing methods work with multi-file loaded roles
            const roles = SystemMessages.getAvailableRoles();

            for (const role of roles) {
                expect(() => SystemMessages.getSystemMessage(role)).not.toThrow();
                expect(() => SystemMessages.getLevel(role)).not.toThrow();
                expect(() => SystemMessages.getExcludedTools(role)).not.toThrow();
                expect(() => SystemMessages.getIncludedTools(role)).not.toThrow();
                expect(SystemMessages.hasRole(role)).toBe(true);
            }
        });

        it('should handle role validation across all loaded roles', () => {
            // Test that validation works for roles from different files
            expect(() =>
                SystemMessages._validateToolConfiguration('research_assistant')
            ).not.toThrow();
            expect(() => SystemMessages._validateToolConfiguration('qa_specialist')).not.toThrow();
            expect(() => SystemMessages._validateToolConfiguration('coder')).not.toThrow();
        });
    });

    describe('Error handling', () => {
        it('should throw error for unknown roles', () => {
            expect(() => {
                SystemMessages.getSystemMessage('unknown_role');
            }).toThrow('Unknown role: unknown_role');
        });

        it('should provide helpful error messages listing available roles', () => {
            try {
                SystemMessages.getSystemMessage('unknown_role');
            } catch (error) {
                expect(error.message).toContain('Available roles:');
                expect(error.message).toContain('coder');
                expect(error.message).toContain('basic_assistant');
                expect(error.message).toContain('test_writer');
            }
        });
    });

    describe('Tool filtering with multi-file roles', () => {
        it('should correctly filter tools for roles with includedTools', () => {
            expect(SystemMessages.isToolIncluded('research_assistant', 'read_file')).toBe(true);
            expect(SystemMessages.isToolIncluded('research_assistant', 'write_file')).toBe(false);
            expect(SystemMessages.isToolIncluded('qa_specialist', 'exact_search')).toBe(true);
            expect(SystemMessages.isToolIncluded('qa_specialist', 'execute_terminal')).toBe(false);
        });

        it('should correctly filter tools for roles with excludedTools', () => {
            expect(SystemMessages.isToolExcluded('coder', 'get_time')).toBe(true);
            expect(SystemMessages.isToolExcluded('coder', 'read_file')).toBe(false);
            expect(SystemMessages.isToolExcluded('basic_assistant', 'edit_file')).toBe(true);
            expect(SystemMessages.isToolExcluded('basic_assistant', 'read_file')).toBe(false);
        });
    });
});
