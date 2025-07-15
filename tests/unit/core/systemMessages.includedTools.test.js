import { describe, it, expect, vi, beforeEach } from 'vitest';
import SystemMessages from '../../../src/core/ai/systemMessages.js';

// Mock the configuration loader
vi.mock('../../../src/config/validation/configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(() => ({
        loadConfig: vi.fn(path => {
            if (path === 'roles/roles.json') {
                return {
                    test_included_only: {
                        includedTools: ['read_file', 'write_file', '*search*'],
                    },
                    test_excluded_only: {
                        excludedTools: ['get_time', 'calculate'],
                    },
                    test_neither: {
                        // Neither includedTools nor excludedTools
                    },
                    test_empty_included: {
                        includedTools: [],
                    },
                    test_empty_excluded: {
                        excludedTools: [],
                    },
                    test_mutual_exclusion: {
                        includedTools: ['read_file'],
                        excludedTools: ['write_file'],
                    },
                    test_included_patterns: {
                        includedTools: ['*file', '/^execute_/', 'exact_tool'],
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
                    test_included_only: {
                        includedTools: ['read_file', 'write_file', '*search*'],
                    },
                    test_excluded_only: {
                        excludedTools: ['get_time', 'calculate'],
                    },
                    test_neither: {
                        // Neither includedTools nor excludedTools
                    },
                    test_empty_included: {
                        includedTools: [],
                    },
                    test_empty_excluded: {
                        excludedTools: [],
                    },
                    test_mutual_exclusion: {
                        includedTools: ['read_file'],
                        excludedTools: ['write_file'],
                    },
                    test_included_patterns: {
                        includedTools: ['*file', '/^execute_/', 'exact_tool'],
                    },
                };
            }
            return {};
        }),
        clearCache: vi.fn(),
    })),
}));

describe('SystemMessages - includedTools functionality', () => {
    beforeEach(() => {
        // Clear any cached instances
        vi.clearAllMocks();
    });

    describe('getIncludedTools', () => {
        it('should return includedTools array when present', () => {
            const tools = SystemMessages.getIncludedTools('test_included_only');
            expect(tools).toEqual(['read_file', 'write_file', '*search*']);
        });

        it('should return empty array when includedTools not present', () => {
            const tools = SystemMessages.getIncludedTools('test_excluded_only');
            expect(tools).toEqual([]);
        });

        it('should return empty array when includedTools is empty', () => {
            const tools = SystemMessages.getIncludedTools('test_empty_included');
            expect(tools).toEqual([]);
        });

        it('should throw error for unknown role', () => {
            expect(() => {
                SystemMessages.getIncludedTools('unknown_role');
            }).toThrow('Unknown role: unknown_role');
        });
    });

    describe('_validateToolConfiguration', () => {
        it('should not throw when only includedTools is present', () => {
            expect(() => {
                SystemMessages._validateToolConfiguration('test_included_only');
            }).not.toThrow();
        });

        it('should not throw when only excludedTools is present', () => {
            expect(() => {
                SystemMessages._validateToolConfiguration('test_excluded_only');
            }).not.toThrow();
        });

        it('should not throw when neither is present', () => {
            expect(() => {
                SystemMessages._validateToolConfiguration('test_neither');
            }).not.toThrow();
        });

        it('should not throw when both are empty', () => {
            expect(() => {
                SystemMessages._validateToolConfiguration('test_empty_included');
            }).not.toThrow();
        });

        it('should throw when both includedTools and excludedTools are present', () => {
            expect(() => {
                SystemMessages._validateToolConfiguration('test_mutual_exclusion');
            }).toThrow(
                "Role 'test_mutual_exclusion' cannot have both 'includedTools' and 'excludedTools' properties. They are mutually exclusive."
            );
        });

        it('should throw error for unknown role', () => {
            expect(() => {
                SystemMessages._validateToolConfiguration('unknown_role');
            }).toThrow('Unknown role: unknown_role');
        });
    });

    describe('isToolIncluded', () => {
        describe('with includedTools', () => {
            it('should include tools that match exact patterns', () => {
                expect(SystemMessages.isToolIncluded('test_included_only', 'read_file')).toBe(true);
                expect(SystemMessages.isToolIncluded('test_included_only', 'write_file')).toBe(
                    true
                );
            });

            it('should include tools that match wildcard patterns', () => {
                expect(SystemMessages.isToolIncluded('test_included_only', 'exact_search')).toBe(
                    true
                );
                expect(SystemMessages.isToolIncluded('test_included_only', 'fuzzy_search')).toBe(
                    true
                );
                expect(SystemMessages.isToolIncluded('test_included_only', 'search_files')).toBe(
                    true
                );
            });

            it('should exclude tools that do not match any pattern', () => {
                expect(SystemMessages.isToolIncluded('test_included_only', 'get_time')).toBe(false);
                expect(SystemMessages.isToolIncluded('test_included_only', 'calculate')).toBe(
                    false
                );
                expect(SystemMessages.isToolIncluded('test_included_only', 'execute_command')).toBe(
                    false
                );
            });

            it('should work with regex patterns', () => {
                expect(
                    SystemMessages.isToolIncluded('test_included_patterns', 'execute_command')
                ).toBe(true);
                expect(
                    SystemMessages.isToolIncluded('test_included_patterns', 'execute_script')
                ).toBe(true);
                expect(SystemMessages.isToolIncluded('test_included_patterns', 'run_execute')).toBe(
                    false
                );
            });

            it('should work with exact tool names', () => {
                expect(SystemMessages.isToolIncluded('test_included_patterns', 'exact_tool')).toBe(
                    true
                );
                expect(
                    SystemMessages.isToolIncluded('test_included_patterns', 'exact_tool_extended')
                ).toBe(false);
            });
        });

        describe('with excludedTools', () => {
            it('should include tools that are not excluded', () => {
                expect(SystemMessages.isToolIncluded('test_excluded_only', 'read_file')).toBe(true);
                expect(SystemMessages.isToolIncluded('test_excluded_only', 'write_file')).toBe(
                    true
                );
                expect(SystemMessages.isToolIncluded('test_excluded_only', 'execute_command')).toBe(
                    true
                );
            });

            it('should exclude tools that match exclusion patterns', () => {
                expect(SystemMessages.isToolIncluded('test_excluded_only', 'get_time')).toBe(false);
                expect(SystemMessages.isToolIncluded('test_excluded_only', 'calculate')).toBe(
                    false
                );
            });
        });

        describe('with neither includedTools nor excludedTools', () => {
            it('should exclude all tools by default', () => {
                expect(SystemMessages.isToolIncluded('test_neither', 'read_file')).toBe(false);
                expect(SystemMessages.isToolIncluded('test_neither', 'write_file')).toBe(false);
                expect(SystemMessages.isToolIncluded('test_neither', 'get_time')).toBe(false);
                expect(SystemMessages.isToolIncluded('test_neither', 'calculate')).toBe(false);
            });
        });

        describe('with empty arrays', () => {
            it('should exclude all tools when includedTools is empty', () => {
                expect(SystemMessages.isToolIncluded('test_empty_included', 'read_file')).toBe(
                    false
                );
                expect(SystemMessages.isToolIncluded('test_empty_included', 'write_file')).toBe(
                    false
                );
            });

            it('should include all tools when excludedTools is empty', () => {
                expect(SystemMessages.isToolIncluded('test_empty_excluded', 'read_file')).toBe(
                    true
                );
                expect(SystemMessages.isToolIncluded('test_empty_excluded', 'write_file')).toBe(
                    true
                );
                expect(SystemMessages.isToolIncluded('test_empty_excluded', 'get_time')).toBe(true);
            });
        });

        it('should throw error for mutual exclusion', () => {
            expect(() => {
                SystemMessages.isToolIncluded('test_mutual_exclusion', 'read_file');
            }).toThrow(
                "Role 'test_mutual_exclusion' cannot have both 'includedTools' and 'excludedTools' properties. They are mutually exclusive."
            );
        });
    });

    describe('isToolExcluded (deprecated)', () => {
        it('should return opposite of isToolIncluded', () => {
            expect(SystemMessages.isToolExcluded('test_included_only', 'read_file')).toBe(false);
            expect(SystemMessages.isToolExcluded('test_included_only', 'get_time')).toBe(true);

            expect(SystemMessages.isToolExcluded('test_excluded_only', 'read_file')).toBe(false);
            expect(SystemMessages.isToolExcluded('test_excluded_only', 'get_time')).toBe(true);

            expect(SystemMessages.isToolExcluded('test_neither', 'read_file')).toBe(true);
        });
    });
});
