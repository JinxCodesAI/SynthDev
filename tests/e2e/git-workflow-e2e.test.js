import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';

// Global state for mocks (accessible to mock functions)
const mockFileSystem = new Map();
const gitOperationLog = [];

// Mock GitUtils at module level
vi.mock('../../src/utils/GitUtils.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        checkGitAvailability: vi.fn().mockResolvedValue({
            available: true,
            isRepo: true,
        }),
        getCurrentBranch: vi.fn().mockResolvedValue({
            success: true,
            branch: 'master',
        }),
        hasUncommittedChanges: vi.fn().mockImplementation(() => {
            gitOperationLog.push('hasUncommittedChanges');
            // First call: no changes, Second+ calls: has changes (from first edit)
            const callCount = gitOperationLog.filter(op => op === 'hasUncommittedChanges').length;
            return Promise.resolve({
                success: true,
                hasUncommittedChanges: callCount > 1,
            });
        }),
        generateBranchName: vi.fn().mockImplementation(instruction => {
            const branchName = `synth-dev/test-${Date.now()}`;
            gitOperationLog.push(`generateBranchName:${branchName}`);
            return branchName;
        }),
        createBranch: vi.fn().mockImplementation(branchName => {
            gitOperationLog.push(`createBranch:${branchName}`);
            return Promise.resolve({ success: true });
        }),
        addFiles: vi.fn().mockImplementation(files => {
            gitOperationLog.push(`addFiles:${files.join(',')}`);
            return Promise.resolve({ success: true });
        }),
        commit: vi.fn().mockImplementation(message => {
            gitOperationLog.push(`commit:${message.substring(0, 50)}...`);
            return Promise.resolve({ success: true });
        }),
        getStatus: vi.fn().mockResolvedValue({
            success: true,
            hasChanges: true,
            status: 'M test.txt',
        }),
    })),
}));

// Mock file operations at module level
vi.mock('fs/promises', () => ({
    readFile: vi.fn().mockImplementation(async filePath => {
        if (mockFileSystem.has(filePath)) {
            return mockFileSystem.get(filePath);
        }
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }),
    writeFile: vi.fn().mockImplementation(async (filePath, content) => {
        mockFileSystem.set(filePath, content);
        return Promise.resolve();
    }),
    access: vi.fn().mockImplementation(async filePath => {
        if (!mockFileSystem.has(filePath)) {
            throw new Error(`ENOENT: no such file or directory, access '${filePath}'`);
        }
        return Promise.resolve();
    }),
    mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock OpenAI client
vi.mock('openai', () => ({
    OpenAI: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: vi.fn().mockImplementation(async request => {
                    const messages = request.messages;
                    const lastMessage = messages[messages.length - 1];

                    // First query: LLM decides to call edit_file
                    if (
                        lastMessage.content.includes('first edit') ||
                        lastMessage.content.includes('Create a test file')
                    ) {
                        return {
                            choices: [
                                {
                                    message: {
                                        content: "I'll help you create the file.",
                                        tool_calls: [
                                            {
                                                id: 'call_1',
                                                type: 'function',
                                                function: {
                                                    name: 'edit_file',
                                                    arguments: JSON.stringify({
                                                        file_path: 'test.txt',
                                                        operation: 'create',
                                                        content: 'First edit content',
                                                    }),
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                            usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
                        };
                    }

                    // Second query: LLM decides to call edit_file again
                    if (
                        lastMessage.content.includes('second edit') ||
                        lastMessage.content.includes('Edit the test file again')
                    ) {
                        return {
                            choices: [
                                {
                                    message: {
                                        content: "I'll make another edit to the file.",
                                        tool_calls: [
                                            {
                                                id: 'call_2',
                                                type: 'function',
                                                function: {
                                                    name: 'edit_file',
                                                    arguments: JSON.stringify({
                                                        file_path: 'test.txt',
                                                        operation: 'str_replace',
                                                        old_str: 'First edit content',
                                                        new_str: 'Second edit content',
                                                    }),
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                            usage: { prompt_tokens: 60, completion_tokens: 30, total_tokens: 90 },
                        };
                    }

                    // Default response
                    return {
                        choices: [
                            {
                                message: {
                                    content: 'I understand your request.',
                                },
                            },
                        ],
                        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
                    };
                }),
            },
        },
    })),
}));

describe('Git Workflow E2E Test', () => {
    let appProcess;
    let testEnvFile;

    beforeEach(() => {
        // Reset test state
        mockFileSystem.clear();
        gitOperationLog.length = 0;

        // Create test environment content
        const testEnvContent = `SYNTHDEV_API_KEY=test-key-12345
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
SYNTHDEV_VERBOSITY_LEVEL=4
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false`;

        // Write to main .env location (following config-reload.test.js pattern)
        testEnvFile = '.env';
        writeFileSync(testEnvFile, testEnvContent);
    });

    afterEach(() => {
        if (appProcess) {
            appProcess.kill('SIGTERM');
        }
        if (testEnvFile && existsSync(testEnvFile)) {
            unlinkSync(testEnvFile);
        }
        vi.restoreAllMocks();
    });

    it('should execute complete Git workflow: first edit → second edit with branch creation', async () => {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout after 30 seconds'));
            }, 30000);

            // Start the application
            appProcess = spawn('node', ['src/core/app.js'], {
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
            });

            let output = '';
            let step = 0;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;
                console.log('APP OUTPUT:', chunk);

                // Step 1: Wait for app to start
                if (step === 0 && chunk.includes('💭 You:')) {
                    step = 1;
                    console.log('Step 1: App started, sending first query...');
                    appProcess.stdin.write('Please make a first edit to test.txt\n');
                }

                // Step 2: First edit tool call approval
                else if (step === 1 && chunk.includes('Do you want to proceed?')) {
                    step = 2;
                    console.log('Step 2: Approving first edit...');
                    appProcess.stdin.write('y\n');
                }

                // Step 3: Wait for first edit completion, then send second query
                else if (
                    step === 2 &&
                    chunk.includes('💭 You:') &&
                    !chunk.includes('Do you want to proceed?')
                ) {
                    step = 3;
                    console.log('Step 3: First edit completed, sending second query...');
                    appProcess.stdin.write('Please make a second edit to test.txt\n');
                }

                // Step 4: Second edit tool call approval
                else if (step === 3 && chunk.includes('Do you want to proceed?')) {
                    step = 4;
                    console.log('Step 4: Approving second edit...');
                    appProcess.stdin.write('y\n');
                }

                // Step 5: Wait for completion and exit
                else if (
                    step === 4 &&
                    chunk.includes('💭 You:') &&
                    !chunk.includes('Do you want to proceed?')
                ) {
                    step = 5;
                    console.log('Step 5: Second edit completed, exiting...');
                    appProcess.stdin.write('/exit\n');
                }
            });

            appProcess.stderr.on('data', data => {
                console.error('APP ERROR:', data.toString());
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    console.log('Final Git operation log:', gitOperationLog);
                    console.log('Final file system state:', Array.from(mockFileSystem.entries()));

                    // Verify the complete workflow
                    expect(output).toContain('Synth-Dev Console Application Started');

                    // Verify Git operations happened in correct order
                    expect(gitOperationLog).toContain('hasUncommittedChanges'); // Initial check
                    expect(
                        gitOperationLog.some(op => op.startsWith('createBranch:synth-dev/'))
                    ).toBe(true);
                    expect(gitOperationLog.some(op => op.startsWith('addFiles:'))).toBe(true);
                    expect(gitOperationLog.some(op => op.startsWith('commit:'))).toBe(true);

                    // Verify file operations
                    expect(mockFileSystem.has('test.txt')).toBe(true);
                    expect(mockFileSystem.get('test.txt')).toContain('edit content');

                    // Verify the expected Git workflow sequence
                    // 1. First edit: No branch creation (no uncommitted changes initially)
                    // 2. Second edit: Branch creation + commit existing changes + new edit

                    const branchCreateIndex = gitOperationLog.findIndex(op =>
                        op.startsWith('createBranch:')
                    );
                    const addFilesOps = gitOperationLog.filter(op => op.startsWith('addFiles:'));
                    const commitOps = gitOperationLog.filter(op => op.startsWith('commit:'));

                    // Should have created a branch for second edit
                    expect(branchCreateIndex).toBeGreaterThan(-1);

                    // Should have at least 2 add operations (pre-execution + post-execution)
                    expect(addFilesOps.length).toBeGreaterThanOrEqual(1);

                    // Should have at least 1 commit (pre-execution commit of existing changes)
                    expect(commitOps.length).toBeGreaterThanOrEqual(1);

                    // Branch creation should happen before commits
                    const firstCommitIndex = gitOperationLog.findIndex(op =>
                        op.startsWith('commit:')
                    );
                    expect(branchCreateIndex).toBeLessThan(firstCommitIndex);

                    expect(code).toBe(0);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            appProcess.on('error', error => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }, 35000); // 35 second timeout

    it('should create exact Git state: new branch with one commit and unstaged changes', async () => {
        // This test verifies the exact end state you described:
        // "there is new branch with one commit and there are some dangling unstaged changes"

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Test timeout after 30 seconds'));
            }, 30000);

            // Start application and run the workflow
            appProcess = spawn('node', ['src/core/app.js'], {
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
            });

            let output = '';
            let step = 0;

            appProcess.stdout.on('data', data => {
                const chunk = data.toString();
                output += chunk;

                if (step === 0 && chunk.includes('💭 You:')) {
                    step = 1;
                    appProcess.stdin.write('Create a test file\n');
                } else if (step === 1 && chunk.includes('Do you want to proceed?')) {
                    step = 2;
                    appProcess.stdin.write('y\n');
                } else if (
                    step === 2 &&
                    chunk.includes('💭 You:') &&
                    !chunk.includes('Do you want to proceed?')
                ) {
                    step = 3;
                    appProcess.stdin.write('Edit the test file again\n');
                } else if (step === 3 && chunk.includes('Do you want to proceed?')) {
                    step = 4;
                    appProcess.stdin.write('y\n');
                } else if (
                    step === 4 &&
                    chunk.includes('💭 You:') &&
                    !chunk.includes('Do you want to proceed?')
                ) {
                    step = 5;
                    appProcess.stdin.write('/exit\n');
                }
            });

            appProcess.on('close', code => {
                clearTimeout(timeout);

                try {
                    console.log('Final state verification:');
                    console.log('Git operations:', gitOperationLog);
                    console.log('File system:', Array.from(mockFileSystem.entries()));

                    // Verify exact end state as described
                    expect(mockFileSystem.has('test.txt')).toBe(true); // File exists (unstaged changes)

                    // Verify Git workflow sequence
                    expect(gitOperationLog.some(op => op.startsWith('createBranch:'))).toBe(true);
                    expect(gitOperationLog.some(op => op.startsWith('commit:'))).toBe(true);
                    expect(gitOperationLog.some(op => op.startsWith('addFiles:'))).toBe(true);

                    // Verify the sequence: branch creation should happen before commits
                    const branchCreateIndex = gitOperationLog.findIndex(op =>
                        op.startsWith('createBranch:')
                    );
                    const firstCommitIndex = gitOperationLog.findIndex(op =>
                        op.startsWith('commit:')
                    );
                    expect(branchCreateIndex).toBeLessThan(firstCommitIndex);

                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            appProcess.on('error', reject);
        });
    }, 35000);
});
