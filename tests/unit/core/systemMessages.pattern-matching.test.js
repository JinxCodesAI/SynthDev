// tests/unit/core/systemMessages.pattern-matching.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

// Mock the configuration loader
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        loadConfig: vi.fn(path => {
            if (path === 'roles/roles.json') {
                return {
                    test_exact: {
                        excludedTools: ['get_time', 'calculate'],
                    },
                    test_wildcard: {
                        excludedTools: ['*file', 'test_*', '*_tool'],
                    },
                    test_regex: {
                        excludedTools: ['/^execute_/', '/terminal$/i', '/^(read|write)_file$/'],
                    },
                    test_mixed: {
                        excludedTools: ['get_time', '*file', '/^execute_/', '/terminal$/i'],
                    },
                    test_invalid: {
                        excludedTools: ['/[invalid/', '*'],
                    },
                };
            }
            if (path === 'defaults/environment-template.json') {
                return {
                    template: 'Test environment',
                };
            }
            if (path === 'roles/environment-template.json') {
                return {
                    template: 'Test environment',
                };
            }
            return {};
        }),
        loadRolesFromDirectory: vi.fn(dirPath => {
            if (dirPath === 'roles') {
                return {
                    test_exact: {
                        excludedTools: ['get_time', 'calculate'],
                    },
                    test_wildcard: {
                        excludedTools: ['*file', 'test_*', '*_tool'],
                    },
                    test_regex: {
                        excludedTools: ['/^execute_/', '/terminal$/i', '/^(read|write)_file$/'],
                    },
                    test_mixed: {
                        excludedTools: ['get_time', '*file', '/^execute_/', '/terminal$/i'],
                    },
                    test_invalid: {
                        excludedTools: ['/[invalid/', '*'],
                    },
                };
            }
            return {};
        }),
        clearCache: vi.fn(),
    })),
}));

describe('SystemMessages Pattern Matching', () => {
    beforeEach(() => {
        // Clear any cached instances
        SystemMessages.reloadRoles();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('_matchesExclusionPattern', () => {
        describe('exact string matching', () => {
            it('should match exact strings', () => {
                expect(SystemMessages._matchesExclusionPattern('get_time', 'get_time')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('calculate', 'calculate')).toBe(
                    true
                );
                expect(SystemMessages._matchesExclusionPattern('get_time', 'calculate')).toBe(
                    false
                );
            });

            it('should handle empty or null inputs', () => {
                expect(SystemMessages._matchesExclusionPattern('', 'pattern')).toBe(false);
                expect(SystemMessages._matchesExclusionPattern('tool', '')).toBe(false);
                expect(SystemMessages._matchesExclusionPattern(null, 'pattern')).toBe(false);
                expect(SystemMessages._matchesExclusionPattern('tool', null)).toBe(false);
            });
        });

        describe('wildcard patterns', () => {
            it('should match wildcard patterns at the end', () => {
                expect(SystemMessages._matchesExclusionPattern('read_file', '*file')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('write_file', '*file')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('edit_file', '*file')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('file_reader', '*file')).toBe(false);
            });

            it('should match wildcard patterns at the beginning', () => {
                expect(SystemMessages._matchesExclusionPattern('test_tool', 'test_*')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('test_helper', 'test_*')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('other_test', 'test_*')).toBe(false);
            });

            it('should match wildcard patterns in the middle', () => {
                expect(SystemMessages._matchesExclusionPattern('read_file_tool', '*_tool')).toBe(
                    true
                );
                expect(SystemMessages._matchesExclusionPattern('write_data_tool', '*_tool')).toBe(
                    true
                );
                expect(SystemMessages._matchesExclusionPattern('tool_helper', '*_tool')).toBe(
                    false
                );
            });

            it('should match multiple wildcards', () => {
                expect(
                    SystemMessages._matchesExclusionPattern('test_file_tool', 'test_*_tool')
                ).toBe(true);
                expect(
                    SystemMessages._matchesExclusionPattern('test_data_tool', 'test_*_tool')
                ).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('test_tool', 'test_*_tool')).toBe(
                    false
                );
            });

            it('should handle single wildcard', () => {
                expect(SystemMessages._matchesExclusionPattern('anything', '*')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('', '*')).toBe(true);
            });
        });

        describe('regex patterns', () => {
            it('should match regex patterns', () => {
                expect(
                    SystemMessages._matchesExclusionPattern('execute_command', '/^execute_/')
                ).toBe(true);
                expect(
                    SystemMessages._matchesExclusionPattern('execute_script', '/^execute_/')
                ).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('run_execute', '/^execute_/')).toBe(
                    false
                );
            });

            it('should handle case-insensitive regex', () => {
                expect(
                    SystemMessages._matchesExclusionPattern('execute_terminal', '/terminal$/i')
                ).toBe(true);
                expect(
                    SystemMessages._matchesExclusionPattern('run_TERMINAL', '/terminal$/i')
                ).toBe(true);
                expect(
                    SystemMessages._matchesExclusionPattern('terminal_run', '/terminal$/i')
                ).toBe(false);
            });

            it('should handle complex regex patterns', () => {
                expect(
                    SystemMessages._matchesExclusionPattern('read_file', '/^(read|write)_file$/')
                ).toBe(true);
                expect(
                    SystemMessages._matchesExclusionPattern('write_file', '/^(read|write)_file$/')
                ).toBe(true);
                expect(
                    SystemMessages._matchesExclusionPattern('edit_file', '/^(read|write)_file$/')
                ).toBe(false);
            });

            it('should treat invalid regex as literal strings', () => {
                expect(SystemMessages._matchesExclusionPattern('/[invalid/', '/[invalid/')).toBe(
                    true
                );
                expect(SystemMessages._matchesExclusionPattern('test', '/[invalid/')).toBe(false);
            });

            it('should handle regex without closing slash', () => {
                expect(SystemMessages._matchesExclusionPattern('/pattern', '/pattern')).toBe(true);
                expect(SystemMessages._matchesExclusionPattern('test', '/pattern')).toBe(false);
            });
        });
    });

    describe('isToolExcluded', () => {
        it('should work with exact matches', () => {
            expect(SystemMessages.isToolExcluded('test_exact', 'get_time')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_exact', 'calculate')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_exact', 'other_tool')).toBe(false);
        });

        it('should work with wildcard patterns', () => {
            expect(SystemMessages.isToolExcluded('test_wildcard', 'read_file')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_wildcard', 'write_file')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_wildcard', 'test_helper')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_wildcard', 'data_tool')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_wildcard', 'other_command')).toBe(false);
        });

        it('should work with regex patterns', () => {
            expect(SystemMessages.isToolExcluded('test_regex', 'execute_command')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_regex', 'run_terminal')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_regex', 'RUN_TERMINAL')).toBe(true); // case insensitive
            expect(SystemMessages.isToolExcluded('test_regex', 'read_file')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_regex', 'write_file')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_regex', 'edit_file')).toBe(false);
        });

        it('should work with mixed patterns', () => {
            expect(SystemMessages.isToolExcluded('test_mixed', 'get_time')).toBe(true); // exact
            expect(SystemMessages.isToolExcluded('test_mixed', 'read_file')).toBe(true); // wildcard
            expect(SystemMessages.isToolExcluded('test_mixed', 'execute_command')).toBe(true); // regex
            expect(SystemMessages.isToolExcluded('test_mixed', 'run_terminal')).toBe(true); // regex case insensitive
            expect(SystemMessages.isToolExcluded('test_mixed', 'other_tool')).toBe(false);
        });

        it('should handle invalid patterns gracefully', () => {
            expect(SystemMessages.isToolExcluded('test_invalid', '/[invalid/')).toBe(true); // treated as literal
            expect(SystemMessages.isToolExcluded('test_invalid', 'anything')).toBe(true); // single wildcard
            expect(SystemMessages.isToolExcluded('test_invalid', 'test')).toBe(true); // single wildcard matches
        });

        it('should throw error for unknown role', () => {
            expect(() => {
                SystemMessages.isToolExcluded('unknown_role', 'tool');
            }).toThrow('Unknown role: unknown_role');
        });
    });

    describe('backward compatibility', () => {
        it('should maintain backward compatibility with getExcludedTools', () => {
            const excludedTools = SystemMessages.getExcludedTools('test_exact');
            expect(excludedTools).toEqual(['get_time', 'calculate']);
        });

        it('should work with existing role configurations', () => {
            // Test that existing exact matches still work
            expect(SystemMessages.isToolExcluded('test_exact', 'get_time')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_exact', 'calculate')).toBe(true);
            expect(SystemMessages.isToolExcluded('test_exact', 'other_tool')).toBe(false);
        });
    });
});
