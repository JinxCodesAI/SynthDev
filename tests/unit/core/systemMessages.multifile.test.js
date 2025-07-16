// tests/unit/core/systemMessages.multifile.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

// Mock the configuration loader to simulate multi-file loading
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
                // Simulate loading from multiple files with new structure
                return {
                    roles: {
                        // From roles.json (legacy)
                        coder: {
                            level: 'base',
                            systemMessage: 'You are a coder',
                            excludedTools: ['get_time'],
                            _group: 'global',
                            _source: 'roles.json',
                        },
                        reviewer: {
                            level: 'base',
                            systemMessage: 'You are a reviewer',
                            excludedTools: ['edit_file', 'write_file'],
                            _group: 'global',
                            _source: 'roles.json',
                        },
                        // From specialized/testing-roles.json
                        test_writer: {
                            level: 'base',
                            systemMessage: 'You are a test writer',
                            excludedTools: ['execute_terminal'],
                            _group: 'global',
                            _source: 'test-roles.json',
                        },
                        qa_specialist: {
                            level: 'base',
                            systemMessage: 'You are a QA specialist',
                            includedTools: ['read_file', 'list_directory', 'exact_search'],
                            _group: 'global',
                            _source: 'test-roles.json',
                        },
                        // From testing group
                        basic_assistant: {
                            level: 'fast',
                            systemMessage: 'You are a basic assistant',
                            _group: 'testing',
                            _source: 'basic.testing.json',
                        },
                        file_reader: {
                            level: 'fast',
                            systemMessage: 'You are a file reader',
                            includedTools: ['read_file', 'list_directory', 'exact_search'],
                            _group: 'testing',
                            _source: 'reader.testing.json',
                        },
                    },
                    roleGroups: {
                        global: ['coder', 'reviewer', 'test_writer', 'qa_specialist'],
                        testing: ['basic_assistant', 'file_reader'],
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

describe('SystemMessages - Multi-file Role Loading', () => {
    beforeEach(() => {
        // Mock process.cwd() before tests
        process.cwd = vi.fn(() => '/test/workspace');

        // Clear any cached instances
        vi.clearAllMocks();
        SystemMessages.reloadRoles();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Restore original process.cwd
        process.cwd = originalCwd || (() => '/test/workspace');
    });

    describe('Multi-file role loading', () => {
        it('should load roles from multiple files', () => {
            const availableRoles = SystemMessages.getAvailableRoles();

            // Should include roles from all files
            expect(availableRoles).toContain('coder'); // from roles.json
            expect(availableRoles).toContain('reviewer'); // from roles.json
            expect(availableRoles).toContain('basic_assistant'); // from testing group

            expect(availableRoles.length).toBe(6);
        });

        it('should correctly load system messages from different files', () => {
            expect(SystemMessages.getSystemMessage('coder')).toContain('You are a coder');
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
        });

        it('should correctly handle includedTools from different files', () => {
            expect(SystemMessages.getIncludedTools('file_reader')).toEqual([
                'read_file',
                'list_directory',
                'exact_search',
            ]);
            expect(SystemMessages.getIncludedTools('coder')).toEqual([]); // No includedTools specified
        });

        it('should correctly identify role existence across all files', () => {
            expect(SystemMessages.hasRole('coder')).toBe(true);
            expect(SystemMessages.hasRole('nonexistent_role')).toBe(false);
        });

        it('should get correct role levels from different files', () => {
            expect(SystemMessages.getLevel('coder')).toBe('base');
            expect(SystemMessages.getLevel('reviewer')).toBe('base');
            expect(SystemMessages.getLevel('basic_assistant')).toBe('fast');
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
            expect(SystemMessages.isToolIncluded('file_reader', 'read_file')).toBe(true);
            expect(SystemMessages.isToolIncluded('file_reader', 'write_file')).toBe(false);
        });

        it('should correctly filter tools for roles with excludedTools', () => {
            expect(SystemMessages.isToolExcluded('coder', 'get_time')).toBe(true);
            expect(SystemMessages.isToolExcluded('coder', 'read_file')).toBe(false);
        });
    });
});
