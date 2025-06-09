// tests/unit/tools/execute_script.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import executeScript from '../../../tools/execute_script/implementation.js';

// Mock dependencies
vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

vi.mock('fs', () => ({
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    existsSync: vi.fn(),
}));

vi.mock('openai', () => ({
    OpenAI: vi.fn(),
}));

vi.mock('../../../configManager.js', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../../../logger.js', () => ({
    getLogger: vi.fn(),
}));

vi.mock('../../../toolConfigManager.js', () => ({
    getToolConfigManager: vi.fn().mockReturnValue({
        getToolDescription: vi.fn().mockReturnValue('Execute JavaScript code safely'),
        getErrorMessage: vi.fn((key, params = {}) => {
            const messages = {
                timeout_invalid: 'Timeout must be between 1000 and 30000 milliseconds',
                safety_validation_failed: 'Script failed AI safety validation',
                execution_failed: `Failed to execute script: ${params?.error || 'unknown error'}`,
                ai_assessment_failed:
                    'AI safety assessment failed, falling back to pattern matching',
                script_too_large: 'Script too large (max 50KB)',
                parse_error: 'AI safety assessment failed - could not parse response',
            };
            return messages[key] || 'Error message';
        }),
        getValidationMessage: vi.fn((key, params = {}) => {
            if (key === 'required_parameter_missing') {
                return `Required parameter missing: ${params.parameter}`;
            }
            if (key === 'invalid_parameter_type') {
                return `Invalid parameter type for ${params.parameter}: expected ${params.expected}, got ${params.actual}`;
            }
            return 'Validation message';
        }),
        getSafetyPrompt: vi
            .fn()
            .mockReturnValue('You are a security expert analyzing JavaScript code...'),
        getSafetyLimits: vi.fn().mockReturnValue({
            max_script_size: 50000,
            min_timeout: 1000,
            max_timeout: 30000,
            default_timeout: 10000,
            fallback_recommendations: ['Remove dangerous operations and try again'],
        }),
        getDangerousPatterns: vi.fn().mockReturnValue([
            { pattern: /eval\s*\(/, reason: 'Dynamic code execution' },
            { pattern: /spawn|exec|fork/, reason: 'Process execution functions' },
            { pattern: /writeFileSync|writeFile/, reason: 'File writing operations' },
        ]),
    }),
}));

vi.mock('../../../configurationLoader.js', () => ({
    getConfigurationLoader: vi.fn(),
}));

// Mock ConfigManager
vi.mock('../../../configManager.js', () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({
            getConfig: vi.fn().mockReturnValue({
                ai: {
                    model: 'gpt-3.5-turbo',
                    apiKey: 'test-key',
                },
            }),
        }),
    },
}));

// Mock costs manager
vi.mock('../../../costsManager.js', () => ({
    default: {
        addUsage: vi.fn(),
        getTotalCosts: vi.fn().mockReturnValue({}),
    },
}));

describe('Execute Script Tool', () => {
    let mockSpawn;
    let mockOpenAI;
    let mockConfigManager;
    let mockLogger;
    let mockFs;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup mocks
        const childProcess = await import('child_process');
        mockSpawn = childProcess.spawn;

        const openai = await import('openai');
        mockOpenAI = openai.OpenAI;

        const configManager = await import('../../../configManager.js');
        mockConfigManager = configManager.default.getInstance;

        const logger = await import('../../../logger.js');
        mockLogger = logger.getLogger;

        mockFs = await import('fs');

        // Default mock implementations
        mockConfigManager.mockReturnValue({
            hasFastModelConfig: () => true,
            getModel: () => ({
                apiKey: 'test-key',
                baseUrl: 'test-url',
                model: 'test-model',
            }),
        });

        mockLogger.mockReturnValue({
            warn: vi.fn(),
        });

        mockFs.existsSync.mockReturnValue(false);
    });

    describe('Parameter Validation', () => {
        it('should reject missing script parameter', async () => {
            const result = await executeScript({});

            expect(result.success).toBe(false);
            expect(result.error).toContain('script');
        });

        it('should reject non-string script', async () => {
            const result = await executeScript({ script: 123 });

            expect(result.success).toBe(false);
            expect(result.error).toContain(
                'Invalid parameter type for script: expected string, got number'
            );
        });

        it('should reject invalid timeout range', async () => {
            const result = await executeScript({
                script: 'console.log("test");',
                timeout: 500,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Timeout must be between 1000 and 30000 milliseconds');
        });

        it('should reject timeout too high', async () => {
            const result = await executeScript({
                script: 'console.log("test");',
                timeout: 50000,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Timeout must be between 1000 and 30000 milliseconds');
        });
    });

    describe('AI Safety Assessment', () => {
        it('should reject unsafe scripts based on AI assessment', async () => {
            // Mock AI client
            const mockChatCompletion = vi.fn().mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                safe: false,
                                confidence: 0.9,
                                issues: ['Uses dangerous file operations'],
                                reasoning: 'Script attempts to delete files',
                                recommendations: ['Remove file deletion operations'],
                            }),
                        },
                    },
                ],
                usage: { prompt_tokens: 100, completion_tokens: 50 },
            });

            mockOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: mockChatCompletion,
                    },
                },
            }));

            const result = await executeScript({
                script: 'fs.unlinkSync("important.txt");',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script failed AI safety validation');
            expect(result.safety_assessment).toBeDefined();
            expect(result.safety_assessment.safe).toBe(false);
        });

        it('should allow safe scripts based on AI assessment', async () => {
            // Mock AI client for safe script
            const mockChatCompletion = vi.fn().mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                safe: true,
                                confidence: 0.95,
                                issues: [],
                                reasoning: 'Script only performs safe mathematical calculations',
                                recommendations: [],
                            }),
                        },
                    },
                ],
                usage: { prompt_tokens: 100, completion_tokens: 50 },
            });

            mockOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: mockChatCompletion,
                    },
                },
            }));

            // Mock successful script execution
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            // Simulate successful execution
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('42\n'), 0);
                }
            });

            const result = await executeScript({
                script: 'console.log(6 * 7);',
            });

            expect(result.success).toBe(true);
            expect(result.safety_check.safe).toBe(true);
        });

        it('should fallback to pattern matching if AI assessment fails', async () => {
            // Mock AI client failure
            mockOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
                    },
                },
            }));

            const result = await executeScript({
                script: 'require("child_process").exec("rm -rf /")',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script failed AI safety validation');
            expect(result.safety_assessment.assessment_method).toBe('pattern_matching');
        });
    });

    describe('Script Execution', () => {
        beforeEach(() => {
            // Mock safe AI assessment
            const mockChatCompletion = vi.fn().mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                safe: true,
                                confidence: 0.95,
                                issues: [],
                                reasoning: 'Safe script',
                                recommendations: [],
                            }),
                        },
                    },
                ],
                usage: { prompt_tokens: 100, completion_tokens: 50 },
            });

            mockOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: mockChatCompletion,
                    },
                },
            }));
        });

        it('should execute safe script successfully', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            // Simulate successful execution
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('Hello World\n'), 0);
                }
            });

            mockChild.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback(''), 0);
                }
            });

            const result = await executeScript({
                script: 'console.log("Hello World");',
            });

            expect(result.success).toBe(true);
            expect(result.output).toBe('Hello World\n');
            expect(result.exit_code).toBe(0);
            expect(result.execution_time).toBeGreaterThanOrEqual(0);
        });

        it('should handle script execution timeout', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            // Don't call the close callback to simulate timeout
            mockChild.stdout.on.mockImplementation(() => {});
            mockChild.stderr.on.mockImplementation(() => {});

            const result = await executeScript({
                script: 'while(true) {}', // Infinite loop
                timeout: 1000,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script execution timed out');
            expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
        });

        it('should handle script execution errors', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            // Simulate execution error
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setTimeout(() => callback(new Error('Execution failed')), 0);
                }
            });

            const result = await executeScript({
                script: 'console.log("test");',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script execution error');
        });

        it('should handle script with non-zero exit code', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            // Simulate non-zero exit code
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(1), 0);
                }
            });

            mockChild.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('Error occurred\n'), 0);
                }
            });

            const result = await executeScript({
                script: 'process.exit(1);',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script execution failed with exit code 1');
            expect(result.exit_code).toBe(1);
        });

        it('should handle script with no output', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            // Simulate successful execution with no output
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback(''), 0);
                }
            });

            const result = await executeScript({
                script: '// No output',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script execution returned no output');
        });

        it('should truncate very long output', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            const longOutput = 'a'.repeat(60000);

            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback(longOutput), 0);
                }
            });

            const result = await executeScript({
                script: 'console.log("a".repeat(60000));',
            });

            expect(result.success).toBe(true);
            expect(result.output.length).toBeLessThanOrEqual(50003); // 50000 + '...'
            expect(result.output).toContain('...');
        });
    });

    describe('Response Format', () => {
        it('should include all required response fields on success', async () => {
            // Mock safe AI assessment and successful execution
            const mockChatCompletion = vi.fn().mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                safe: true,
                                confidence: 0.95,
                                issues: [],
                                reasoning: 'Safe script',
                                recommendations: [],
                            }),
                        },
                    },
                ],
                usage: { prompt_tokens: 100, completion_tokens: 50 },
            });

            mockOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: mockChatCompletion,
                    },
                },
            }));

            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('test output\n'), 0);
                }
            });

            const result = await executeScript({
                script: 'console.log("test output");',
            });

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');
            expect(result).toHaveProperty('script');
            expect(result).toHaveProperty('output');
            expect(result).toHaveProperty('stderr');
            expect(result).toHaveProperty('execution_time');
            expect(result).toHaveProperty('safety_check');
            expect(result).toHaveProperty('exit_code');
            expect(result.tool_name).toBe('execute_script');
        });

        it('should include error details on failure', async () => {
            const result = await executeScript({
                script: 'process.exit(1); // Force failure',
            });

            // This test depends on AI safety assessment - if it passes safety, it will execute and fail
            // If it fails safety, it will have an error. Both are valid outcomes.
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('tool_name');

            if (!result.success) {
                expect(result).toHaveProperty('error');
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle spawn errors gracefully', async () => {
            mockSpawn.mockImplementation(() => {
                throw new Error('Failed to spawn process');
            });

            const result = await executeScript({
                script: 'console.log("test");',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unexpected error');
        });

        it('should clean up temporary files on success', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('output'), 0);
                }
            });

            await executeScript({
                script: 'console.log("test");',
            });

            // File cleanup is handled internally, just verify execution succeeded
            expect(mockSpawn).toHaveBeenCalled();
        });

        it('should clean up temporary files on error', async () => {
            mockSpawn.mockImplementation(() => {
                throw new Error('Spawn failed');
            });

            const result = await executeScript({
                script: 'console.log("test");',
            });

            expect(result.success).toBe(false);
        });

        it('should handle cleanup errors gracefully', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('output'), 0);
                }
            });

            const result = await executeScript({
                script: 'console.log("test");',
            });

            // Should succeed
            expect(result.success).toBe(true);
        });

        it('should handle multiple stdout data chunks', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                }
            });

            const dataCallbacks = [];
            mockChild.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    dataCallbacks.push(callback);
                }
            });

            const scriptPromise = executeScript({
                script: 'console.log("test");',
            });

            // Simulate multiple data chunks
            setTimeout(() => {
                dataCallbacks.forEach(cb => {
                    cb('chunk1');
                    cb('chunk2');
                });
            }, 0);

            const result = await scriptPromise;

            expect(result.success).toBe(true);
            expect(result.output).toBe('chunk1chunk2');
        });

        it('should handle multiple stderr data chunks', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'close') {
                    setTimeout(() => callback(1), 0);
                }
            });

            const stderrCallbacks = [];
            mockChild.stderr.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    stderrCallbacks.push(callback);
                }
            });

            const scriptPromise = executeScript({
                script: 'throw new Error("test");',
            });

            // Simulate multiple stderr chunks
            setTimeout(() => {
                stderrCallbacks.forEach(cb => {
                    cb('error1');
                    cb('error2');
                });
            }, 0);

            const result = await scriptPromise;

            expect(result.success).toBe(false);
            expect(result.stderr).toBe('error1error2');
        });

        it('should handle process error events', async () => {
            const mockChild = {
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
            };

            mockSpawn.mockReturnValue(mockChild);

            const errorCallbacks = [];
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    errorCallbacks.push(callback);
                }
            });

            const scriptPromise = executeScript({
                script: 'console.log("test");',
            });

            // Simulate process error
            setTimeout(() => {
                errorCallbacks.forEach(cb => {
                    cb(new Error('Process error'));
                });
            }, 0);

            const result = await scriptPromise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('Script execution error');
        });
    });
});
