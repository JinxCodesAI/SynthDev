/**
 * Cross-Platform Shell Integration Tests
 * Tests to ensure the system works correctly across different operating systems
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import executeTerminal from '../../src/tools/execute_terminal/implementation.js';
import { CmdCommand } from '../../src/commands/terminal/CmdCommand.js';
import CommandGenerator from '../../src/commands/terminal/CommandGenerator.js';

// Mock dependencies
const mockCostsManager = {
    addCost: vi.fn(),
    getCosts: vi.fn().mockReturnValue({ total: 0 }),
};

const mockToolManager = {
    getTool: vi.fn(),
};

const mockConsoleInterface = {
    promptForEditableInput: vi.fn(),
    prompt: vi.fn(),
};

const mockApiClient = {
    addUserMessage: vi.fn(),
};

const mockContext = {
    costsManager: mockCostsManager,
    toolManager: mockToolManager,
    consoleInterface: mockConsoleInterface,
    apiClient: mockApiClient,
};

describe('Cross-Platform Shell Integration', () => {
    let originalPlatform;
    let cmdCommand;
    let commandGenerator;

    beforeEach(() => {
        originalPlatform = process.platform;
        vi.clearAllMocks();

        cmdCommand = new CmdCommand();
        commandGenerator = new CommandGenerator(mockCostsManager, mockToolManager);
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
            writable: true,
        });
    });

    describe('Windows Platform Tests', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                writable: true,
            });
        });

        test('should generate PowerShell commands for file listing on Windows', async () => {
            // Mock AI response for command generation
            const mockAIClient = {
                setSystemMessage: vi.fn(),
                setCallbacks: vi.fn(),
                sendUserMessage: vi.fn().mockImplementation(async () => {
                    // Simulate AI response
                    const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                    callbacks.onResponse({
                        choices: [
                            {
                                message: {
                                    content: 'Get-ChildItem -Path . -Recurse -Filter *docker*',
                                },
                            },
                        ],
                    });
                }),
            };

            // Mock AIAPIClient constructor
            vi.mock('../../src/core/ai/aiAPIClient.js', () => ({
                default: vi.fn().mockImplementation(() => mockAIClient),
            }));

            const result = await commandGenerator.generateCommand(
                'list all files with docker in name'
            );

            expect(result.success).toBe(true);
            expect(result.command).toContain('Get-ChildItem');
            expect(result.command).toContain('-Recurse');
            expect(result.command).toContain('*docker*');
        });

        test('should handle Windows-specific path operations', async () => {
            // Test that Windows paths are handled correctly
            const testCases = [
                {
                    description: 'navigate to C drive',
                    expectedPatterns: ['Set-Location', 'C:\\', 'cd'],
                },
                {
                    description: 'list directory contents with details',
                    expectedPatterns: ['Get-ChildItem', 'dir', '-Force'],
                },
                {
                    description: 'find files by extension',
                    expectedPatterns: ['Get-ChildItem', '*.txt', '-Recurse'],
                },
            ];

            for (const testCase of testCases) {
                const mockAIClient = {
                    setSystemMessage: jest.fn(),
                    setCallbacks: jest.fn(),
                    sendUserMessage: jest.fn().mockImplementation(async () => {
                        const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                        // Generate a Windows-appropriate command
                        let command = 'Get-ChildItem -Path . -Recurse';
                        if (testCase.description.includes('navigate')) {
                            command = 'Set-Location C:\\';
                        } else if (testCase.description.includes('extension')) {
                            command = 'Get-ChildItem -Path . -Recurse -Include *.txt';
                        }

                        callbacks.onResponse({
                            choices: [
                                {
                                    message: { content: command },
                                },
                            ],
                        });
                    }),
                };

                jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                    default: jest.fn().mockImplementation(() => mockAIClient),
                }));

                const result = await commandGenerator.generateCommand(testCase.description);
                expect(result.success).toBe(true);

                // Check that at least one expected pattern is present
                const hasExpectedPattern = testCase.expectedPatterns.some(pattern =>
                    result.command.includes(pattern)
                );
                expect(hasExpectedPattern).toBe(true);
            }
        });
    });

    describe('macOS Platform Tests', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin',
                writable: true,
            });
        });

        test('should generate Unix commands for file operations on macOS', async () => {
            const mockAIClient = {
                setSystemMessage: jest.fn(),
                setCallbacks: jest.fn(),
                sendUserMessage: jest.fn().mockImplementation(async () => {
                    const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                    callbacks.onResponse({
                        choices: [
                            {
                                message: {
                                    content: 'find . -name "*docker*" -type f',
                                },
                            },
                        ],
                    });
                }),
            };

            jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                default: jest.fn().mockImplementation(() => mockAIClient),
            }));

            const result = await commandGenerator.generateCommand(
                'find all files with docker in name'
            );

            expect(result.success).toBe(true);
            expect(result.command).toContain('find');
            expect(result.command).toContain('*docker*');
        });

        test('should handle macOS-specific operations', async () => {
            const testCases = [
                {
                    description: 'show hidden files',
                    expectedCommand: 'ls -la',
                },
                {
                    description: 'check disk usage',
                    expectedCommand: 'df -h',
                },
                {
                    description: 'find process by name',
                    expectedCommand: 'ps aux | grep',
                },
            ];

            for (const testCase of testCases) {
                const mockAIClient = {
                    setSystemMessage: jest.fn(),
                    setCallbacks: jest.fn(),
                    sendUserMessage: jest.fn().mockImplementation(async () => {
                        const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                        callbacks.onResponse({
                            choices: [
                                {
                                    message: { content: testCase.expectedCommand },
                                },
                            ],
                        });
                    }),
                };

                jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                    default: jest.fn().mockImplementation(() => mockAIClient),
                }));

                const result = await commandGenerator.generateCommand(testCase.description);
                expect(result.success).toBe(true);
                expect(result.command).toContain(testCase.expectedCommand.split(' ')[0]);
            }
        });
    });

    describe('Linux Platform Tests', () => {
        beforeEach(() => {
            Object.defineProperty(process, 'platform', {
                value: 'linux',
                writable: true,
            });
        });

        test('should generate Linux commands for system operations', async () => {
            const mockAIClient = {
                setSystemMessage: jest.fn(),
                setCallbacks: jest.fn(),
                sendUserMessage: jest.fn().mockImplementation(async () => {
                    const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                    callbacks.onResponse({
                        choices: [
                            {
                                message: {
                                    content:
                                        'grep -r "docker" . --include="*.yml" --include="*.yaml"',
                                },
                            },
                        ],
                    });
                }),
            };

            jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                default: jest.fn().mockImplementation(() => mockAIClient),
            }));

            const result = await commandGenerator.generateCommand(
                'search for docker in yaml files'
            );

            expect(result.success).toBe(true);
            expect(result.command).toContain('grep');
            expect(result.command).toContain('docker');
        });

        test('should handle Linux package management commands', async () => {
            const testCases = [
                {
                    description: 'update package list',
                    expectedPatterns: ['apt update', 'yum update', 'dnf update'],
                },
                {
                    description: 'install package',
                    expectedPatterns: ['apt install', 'yum install', 'dnf install'],
                },
                {
                    description: 'check system processes',
                    expectedPatterns: ['ps aux', 'top', 'htop'],
                },
            ];

            for (const testCase of testCases) {
                const mockAIClient = {
                    setSystemMessage: jest.fn(),
                    setCallbacks: jest.fn(),
                    sendUserMessage: jest.fn().mockImplementation(async () => {
                        const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                        // Use the first expected pattern as the generated command
                        const command = testCase.expectedPatterns[0];
                        callbacks.onResponse({
                            choices: [
                                {
                                    message: { content: command },
                                },
                            ],
                        });
                    }),
                };

                jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                    default: jest.fn().mockImplementation(() => mockAIClient),
                }));

                const result = await commandGenerator.generateCommand(testCase.description);
                expect(result.success).toBe(true);

                // Check that the command contains one of the expected patterns
                const hasExpectedPattern = testCase.expectedPatterns.some(pattern =>
                    result.command.includes(pattern.split(' ')[0])
                );
                expect(hasExpectedPattern).toBe(true);
            }
        });
    });

    describe('Command Validation Across Platforms', () => {
        test('should validate dangerous commands on all platforms', async () => {
            const dangerousCommands = [
                'rm -rf /',
                'format c:',
                'Remove-Item -Recurse -Force C:\\',
                'shutdown -s -t 0',
                'Stop-Computer -Force',
            ];

            for (const command of dangerousCommands) {
                const mockAIClient = {
                    setSystemMessage: jest.fn(),
                    setCallbacks: jest.fn(),
                    sendUserMessage: jest.fn().mockImplementation(async () => {
                        const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                        callbacks.onResponse({
                            choices: [
                                {
                                    message: { content: command },
                                },
                            ],
                        });
                    }),
                };

                jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                    default: jest.fn().mockImplementation(() => mockAIClient),
                }));

                const result = await commandGenerator.generateCommand('dangerous operation');
                expect(result.success).toBe(false);
                expect(result.error).toContain('unsafe');
            }
        });

        test('should allow safe commands on all platforms', async () => {
            const safeCommands = [
                'ls -la',
                'dir',
                'Get-ChildItem',
                'cat file.txt',
                'type file.txt',
                'Get-Content file.txt',
            ];

            for (const command of safeCommands) {
                const mockAIClient = {
                    setSystemMessage: jest.fn(),
                    setCallbacks: jest.fn(),
                    sendUserMessage: jest.fn().mockImplementation(async () => {
                        const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                        callbacks.onResponse({
                            choices: [
                                {
                                    message: { content: command },
                                },
                            ],
                        });
                    }),
                };

                jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                    default: jest.fn().mockImplementation(() => mockAIClient),
                }));

                const result = await commandGenerator.generateCommand('safe operation');
                expect(result.success).toBe(true);
                expect(result.command).toBe(command);
            }
        });
    });

    describe('End-to-End Platform Integration', () => {
        test('should work end-to-end on Windows with PowerShell', async () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                writable: true,
            });

            // Mock the entire flow
            mockConsoleInterface.promptForEditableInput.mockResolvedValue(
                '/cmd Get-ChildItem -Path . -Name'
            );

            const mockAIClient = {
                setSystemMessage: jest.fn(),
                setCallbacks: jest.fn(),
                sendUserMessage: jest.fn().mockImplementation(async () => {
                    const callbacks = mockAIClient.setCallbacks.mock.calls[0][0];
                    callbacks.onResponse({
                        choices: [
                            {
                                message: {
                                    content: 'Get-ChildItem -Path . -Name',
                                },
                            },
                        ],
                    });
                }),
            };

            jest.unstable_mockModule('../../src/core/ai/aiAPIClient.js', () => ({
                default: jest.fn().mockImplementation(() => mockAIClient),
            }));

            // Mock execute_terminal to return success
            jest.unstable_mockModule('../../src/tools/execute_terminal/implementation.js', () => ({
                default: jest.fn().mockResolvedValue({
                    success: true,
                    stdout: 'file1.txt\nfile2.txt\nfolder1',
                    stderr: '',
                }),
            }));

            const result = await cmdCommand.implementation(
                '??? list files in current directory',
                mockContext
            );
            expect(result).toBe(true);
        });
    });
});
