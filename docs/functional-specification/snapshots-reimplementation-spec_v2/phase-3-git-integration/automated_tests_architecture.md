# Phase 3: Automated Tests Architecture - Git Integration Foundation

## Overview

This document defines the automated testing strategy for Phase 3 Git integration, focusing on comprehensive Git-based snapshot testing with fallbacks to file-based storage. The testing architecture ensures robust Git repository detection, seamless storage mode transitions, and reliable Git operations across all platforms.

## Testing Architecture

### Test Organization

```
tests/snapshot/phase3/
├── unit/
│   ├── git/
│   │   ├── GitSnapshotStore.test.js
│   │   ├── GitAvailabilityDetector.test.js
│   │   ├── GitMetadataExtractor.test.js
│   │   └── GitSnapshotCleanup.test.js
│   ├── storage/
│   │   ├── StorageStrategySelector.test.js
│   │   ├── UnifiedSnapshotManager.test.js
│   │   └── StorageMigrationManager.test.js
│   └── integration/
│       ├── GitIntegration.test.js
│       └── StorageModeSwitching.test.js
├── integration/
│   ├── git-environment/
│   │   ├── RepositoryDetection.test.js
│   │   ├── GitOperations.test.js
│   │   └── StorageModeTransitions.test.js
│   └── migration/
│       ├── Phase2ToPhase3Migration.test.js
│       └── StorageModeMigration.test.js
├── e2e/
│   ├── git-workflows/
│   │   ├── GitSnapshotWorkflow.test.js
│   │   ├── RepositoryStateChanges.test.js
│   │   └── MultiRepository.test.js
│   └── cross-platform/
│       ├── WindowsGit.test.js
│       ├── MacOSGit.test.js
│       └── LinuxGit.test.js
└── fixtures/
    ├── git-repositories/
    │   ├── clean-repository/
    │   ├── dirty-repository/
    │   ├── detached-head-repository/
    │   └── empty-repository/
    └── mock-git/
        ├── mock-git-commands.js
        └── repository-states.json
```

### Test Configuration

#### Phase 3 Vitest Configuration (`tests/snapshot/phase3/vitest.config.js`)

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'phase3-git-integration',
        environment: 'node',
        setupFiles: ['./tests/snapshot/phase3/setup.js'],
        testTimeout: 30000, // Extended for Git operations
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/core/snapshot/**/*.js', 'src/core/snapshot/stores/**/*.js'],
            exclude: ['**/*.test.js', '**/mocks/**'],
            thresholds: {
                global: {
                    branches: 90,
                    functions: 90,
                    lines: 90,
                    statements: 90,
                },
            },
        },
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
                env: {
                    TEST_GIT_INTEGRATION: 'true',
                    TEST_PHASE: '3',
                },
            },
        },
    },
});
```

#### Phase 3 Test Setup (`tests/snapshot/phase3/setup.js`)

```javascript
import { vi, afterEach, beforeAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';

// Global test setup for Phase 3
beforeAll(async () => {
    // Create test directory structure
    const testDir = join(tmpdir(), 'synthdev-phase3-tests');
    await mkdir(testDir, { recursive: true });

    // Set test environment variables
    process.env.TEST_GIT_INTEGRATION = 'true';
    process.env.TEST_PHASE = '3';
});

// Mock Git operations for unit tests
vi.mock('child_process', () => ({
    exec: vi.fn(),
    spawn: vi.fn(),
}));

// Enhanced console mocking for Git operations
globalThis.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
};

// Git-specific cleanup
afterEach(async () => {
    vi.clearAllMocks();

    // Clean up test repositories
    const testDir = join(tmpdir(), 'synthdev-phase3-tests');
    try {
        await rm(testDir, { recursive: true, force: true });
    } catch (error) {
        // Ignore cleanup errors
    }
});
```

## Unit Testing Patterns

### Git Repository Detection Tests

#### GitAvailabilityDetector Unit Tests

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import GitAvailabilityDetector from '../../../src/core/snapshot/GitAvailabilityDetector.js';

vi.mock('child_process');

describe('GitAvailabilityDetector', () => {
    let detector;
    let mockExec;

    beforeEach(() => {
        mockExec = vi.fn();
        detector = new GitAvailabilityDetector({ exec: mockExec });
    });

    describe('isGitRepository', () => {
        it('should detect valid Git repository', async () => {
            mockExec.mockResolvedValue({ stdout: '/test/path', stderr: '' });

            const result = await detector.isGitRepository('/test/path');

            expect(result).toBe(true);
            expect(mockExec).toHaveBeenCalledWith(
                'git -C /test/path rev-parse --git-dir',
                expect.any(Object)
            );
        });

        it('should return false for non-Git directory', async () => {
            mockExec.mockRejectedValue(new Error('fatal: not a git repository'));

            const result = await detector.isGitRepository('/non-git/path');

            expect(result).toBe(false);
        });

        it('should handle Git not installed', async () => {
            mockExec.mockRejectedValue(new Error('git: command not found'));

            const result = await detector.isGitRepository('/any/path');

            expect(result).toBe(false);
        });
    });

    describe('repository validation', () => {
        it('should validate repository health', async () => {
            mockExec.mockImplementation(cmd => {
                if (cmd.includes('rev-parse'))
                    return Promise.resolve({ stdout: '.git', stderr: '' });
                if (cmd.includes('status')) return Promise.resolve({ stdout: 'clean', stderr: '' });
                return Promise.resolve({ stdout: '', stderr: '' });
            });

            const result = await detector.validateRepositoryState('/test/path');

            expect(result.valid).toBe(true);
            expect(result.canWrite).toBe(true);
            expect(result.isClean).toBe(true);
        });
    });
});
```

### Git Snapshot Store Tests

#### GitSnapshotStore Unit Tests

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import GitSnapshotStore from '../../../src/core/snapshot/stores/GitSnapshotStore.js';

vi.mock('child_process');

describe('GitSnapshotStore', () => {
    let store;
    let mockGitUtils;

    beforeEach(() => {
        mockGitUtils = {
            isGitRepository: vi.fn().mockResolvedValue(true),
            createCommit: vi.fn().mockResolvedValue('abc123'),
            createTag: vi.fn().mockResolvedValue(true),
            getCommit: vi.fn().mockResolvedValue({
                hash: 'abc123',
                message: 'SNAPSHOT: Test snapshot',
                author: 'Test User',
                date: new Date(),
            }),
            resetToCommit: vi.fn().mockResolvedValue(true),
            listTags: vi.fn().mockResolvedValue(['snapshot-1', 'snapshot-2']),
            deleteTag: vi.fn().mockResolvedValue(true),
            deleteCommit: vi.fn().mockResolvedValue(true),
        };

        store = new GitSnapshotStore(mockGitUtils);
    });

    describe('store', () => {
        it('should create Git commit for snapshot', async () => {
            const snapshot = {
                id: 'test-snapshot-1',
                description: 'Test snapshot',
                files: { 'test.txt': 'content' },
                metadata: { timestamp: new Date() },
            };

            const result = await store.store(snapshot);

            expect(mockGitUtils.createCommit).toHaveBeenCalledWith(
                expect.stringContaining('SNAPSHOT: Test snapshot'),
                expect.any(Object)
            );
            expect(mockGitUtils.createTag).toHaveBeenCalledWith(
                'snapshot-test-snapshot-1',
                'abc123'
            );
            expect(result).toBe('test-snapshot-1');
        });
    });

    describe('retrieve', () => {
        it('should retrieve snapshot by ID', async () => {
            mockGitUtils.getCommit.mockResolvedValue({
                hash: 'abc123',
                message: 'SNAPSHOT: Test snapshot [metadata]',
                files: { 'test.txt': 'content' },
            });

            const result = await store.retrieve('test-snapshot-1');

            expect(result.id).toBe('test-snapshot-1');
            expect(result.description).toBe('Test snapshot');
            expect(result.files['test.txt']).toBe('content');
        });
    });

    describe('list', () => {
        it('should list all Git snapshots', async () => {
            mockGitUtils.listTags.mockResolvedValue(['snapshot-1', 'snapshot-2']);
            mockGitUtils.getCommit.mockResolvedValue({
                hash: 'abc123',
                message: 'SNAPSHOT: Test snapshot',
                date: new Date(),
            });

            const result = await store.list();

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('2');
        });
    });
});
```

### Storage Strategy Selector Tests

#### StorageStrategySelector Unit Tests

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StorageStrategySelector from '../../../src/core/snapshot/StorageStrategySelector.js';

vi.mock('../../../src/core/snapshot/stores/GitSnapshotStore.js');
vi.mock('../../../src/core/snapshot/stores/MemorySnapshotStore.js');

describe('StorageStrategySelector', () => {
    let selector;
    let mockGitDetector;
    let mockGitStore;
    let mockFileStore;

    beforeEach(() => {
        mockGitDetector = {
            isGitRepository: vi.fn().mockResolvedValue(true),
            validateRepositoryState: vi.fn().mockResolvedValue({ valid: true }),
            shouldUseGitStorage: vi.fn().mockResolvedValue(true),
        };

        mockGitStore = { type: 'git' };
        mockFileStore = { type: 'file' };

        selector = new StorageStrategySelector(mockGitDetector, {
            gitStore: mockGitStore,
            fileStore: mockFileStore,
        });
    });

    describe('selectStorageStrategy', () => {
        it('should select Git strategy for valid repository', async () => {
            const result = await selector.selectStorageStrategy('/test/path');

            expect(result.type).toBe('git');
            expect(mockGitDetector.isGitRepository).toHaveBeenCalledWith('/test/path');
        });

        it('should fallback to file strategy when Git unavailable', async () => {
            mockGitDetector.isGitRepository.mockResolvedValue(false);

            const result = await selector.selectStorageStrategy('/non-git/path');

            expect(result.type).toBe('file');
        });

        it('should handle Git validation failures gracefully', async () => {
            mockGitDetector.validateRepositoryState.mockResolvedValue({
                valid: false,
                reason: 'corrupted',
            });

            const result = await selector.selectStorageStrategy('/corrupted/git');

            expect(result.type).toBe('file');
            expect(result.reason).toContain('corrupted');
        });
    });
});
```

## Integration Testing Patterns

### Git Environment Integration Tests

#### Repository Detection Integration Tests

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { execSync } from 'child_process';
import GitAvailabilityDetector from '../../../src/core/snapshot/GitAvailabilityDetector.js';

describe('Git Integration Tests', () => {
    let testDir;
    let detector;

    beforeEach(async () => {
        testDir = join(tmpdir(), `git-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });
        detector = new GitAvailabilityDetector();
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    describe('Repository Detection', () => {
        it('should detect valid Git repository', async () => {
            // Initialize Git repository
            execSync('git init', { cwd: testDir });
            execSync('git config user.email "test@example.com"', { cwd: testDir });
            execSync('git config user.name "Test User"', { cwd: testDir });

            await writeFile(join(testDir, 'test.txt'), 'content');
            execSync('git add .', { cwd: testDir });
            execSync('git commit -m "Initial commit"', { cwd: testDir });

            const result = await detector.isGitRepository(testDir);
            expect(result).toBe(true);
        });

        it('should handle non-Git directory', async () => {
            await writeFile(join(testDir, 'test.txt'), 'content');

            const result = await detector.isGitRepository(testDir);
            expect(result).toBe(false);
        });

        it('should handle corrupted Git repository', async () => {
            execSync('git init', { cwd: testDir });

            // Corrupt the repository
            await writeFile(join(testDir, '.git', 'HEAD'), 'invalid-ref');

            const result = await detector.validateRepositoryState(testDir);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('corrupted');
        });
    });
});
```

### Storage Mode Transition Integration Tests

#### Storage Mode Switching Tests

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { execSync } from 'child_process';
import StorageStrategySelector from '../../../src/core/snapshot/StorageStrategySelector.js';
import UnifiedSnapshotManager from '../../../src/core/snapshot/UnifiedSnapshotManager.js';

describe('Storage Mode Integration', () => {
    let testDir;
    let manager;

    beforeEach(async () => {
        testDir = join(tmpdir(), `storage-mode-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });

        manager = new UnifiedSnapshotManager();
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    describe('Storage Mode Detection', () => {
        it('should automatically detect Git repositories', async () => {
            execSync('git init', { cwd: testDir });
            execSync('git config user.email "test@example.com"', { cwd: testDir });
            execSync('git config user.name "Test User"', { cwd: testDir });

            const mode = await manager.getCurrentStorageMode(testDir);
            expect(mode).toBe('git');
        });

        it('should fallback to file storage for non-Git directories', async () => {
            const mode = await manager.getCurrentStorageMode(testDir);
            expect(mode).toBe('file');
        });

        it('should handle repository state changes', async () => {
            // Start as non-Git directory
            let mode = await manager.getCurrentStorageMode(testDir);
            expect(mode).toBe('file');

            // Initialize Git repository
            execSync('git init', { cwd: testDir });
            execSync('git config user.email "test@example.com"', { cwd: testDir });
            execSync('git config user.name "Test User"', { cwd: testDir });

            // Should detect Git repository
            mode = await manager.getCurrentStorageMode(testDir);
            expect(mode).toBe('git');
        });
    });
});
```

## End-to-End Testing Patterns

### Git Workflow E2E Tests

#### Complete Git Snapshot Workflow Tests

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { execSync } from 'child_process';
import { spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Git Workflow E2E Tests', () => {
    let testDir;
    let appProcess;

    beforeEach(async () => {
        testDir = join(tmpdir(), `git-e2e-test-${Date.now()}`);
        await mkdir(testDir, { recursive: true });

        // Initialize Git repository
        execSync('git init', { cwd: testDir });
        execSync('git config user.email "test@example.com"', { cwd: testDir });
        execSync('git config user.name "Test User"', { cwd: testDir });

        // Create initial files
        await writeFile(join(testDir, 'README.md'), '# Test Project');
        await writeFile(join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

        execSync('git add .', { cwd: testDir });
        execSync('git commit -m "Initial commit"', { cwd: testDir });
    });

    afterEach(async () => {
        if (appProcess) {
            appProcess.kill();
        }
        await rm(testDir, { recursive: true, force: true });
    });

    describe('Complete Git Snapshot Workflow', () => {
        it('should create, list, and restore Git snapshots', async () => {
            return new Promise(async (resolve, reject) => {
                // Create test file
                await writeFile(join(testDir, 'src.js'), 'console.log("initial");');

                appProcess = spawn(
                    'node',
                    ['../../../src/core/app.js', '--test-mode', '--working-directory', testDir],
                    {
                        cwd: __dirname,
                        stdio: ['pipe', 'pipe', 'pipe'],
                        env: {
                            ...process.env,
                            NODE_ENV: 'test',
                            TEST_GIT_INTEGRATION: 'true',
                        },
                    }
                );

                let output = '';
                const commands = [
                    '/snapshot create "Initial state"\n',
                    '/snapshot list\n',
                    '/snapshot create "After changes"\n',
                    '/snapshot list\n',
                    '/snapshot restore 1\n',
                    'y\n', // Confirm restoration
                    '/snapshot list\n',
                    '/exit\n',
                ];

                let commandIndex = 0;

                appProcess.stdout.on('data', data => {
                    output += data.toString();

                    // Send next command when ready
                    if (
                        commandIndex < commands.length &&
                        (output.includes('You:') || output.includes('confirmation'))
                    ) {
                        appProcess.stdin.write(commands[commandIndex++]);
                    }

                    // Check for completion
                    if (output.includes('Available Commands') && commandIndex >= commands.length) {
                        expect(output).toContain('Git repository detected');
                        expect(output).toContain('SNAPSHOT: Initial state');
                        expect(output).toContain('SNAPSHOT: After changes');
                        expect(output).toContain('Restored successfully');
                        resolve();
                    }
                });

                appProcess.on('error', reject);
                setTimeout(() => reject(new Error('Test timeout')), 15000);
            });
        });
    });
});
```

### Cross-Platform Git Tests

#### Platform-Specific Git Testing

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { platform } from 'os';
import GitAvailabilityDetector from '../../../src/core/snapshot/GitAvailabilityDetector.js';

describe('Cross-Platform Git Tests', () => {
    const currentPlatform = platform();
    let detector;

    beforeEach(() => {
        detector = new GitAvailabilityDetector();
    });

    describe(`${currentPlatform} Platform Tests`, () => {
        it(`should detect Git on ${currentPlatform}`, async () => {
            const result = await detector.isGitInstalled();

            if (currentPlatform === 'win32') {
                expect(result.gitPath).toMatch(/git\.exe$/i);
            } else {
                expect(result.gitPath).toMatch(/git$/);
            }
        });

        it(`should handle ${currentPlatform}-specific Git commands`, async () => {
            const result = await detector.getGitVersion();
            expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
            expect(result.platform).toBe(currentPlatform);
        });
    });
});
```

## Mocking Strategies

### Git Operations Mocking

#### Comprehensive Git Mock

```javascript
// tests/snapshot/phase3/mocks/mockGitOperations.js
export class MockGitOperations {
    constructor() {
        this.repositories = new Map();
        this.commits = new Map();
        this.tags = new Map();
    }

    mockGitInit(path) {
        this.repositories.set(path, {
            initialized: true,
            branches: ['main'],
            currentBranch: 'main',
            commits: [],
            tags: [],
            files: new Map(),
        });
    }

    mockGitCommit(path, message, files = {}) {
        const repo = this.repositories.get(path);
        if (!repo) throw new Error('Repository not found');

        const commit = {
            hash: `commit-${Date.now()}`,
            message,
            files: { ...files },
            timestamp: new Date(),
            parent: repo.commits.length > 0 ? repo.commits[repo.commits.length - 1].hash : null,
        };

        repo.commits.push(commit);
        return commit.hash;
    }

    mockGitTag(path, tagName, commitHash) {
        const repo = this.repositories.get(path);
        if (!repo) throw new Error('Repository not found');

        repo.tags.push({
            name: tagName,
            commitHash,
            timestamp: new Date(),
        });
    }

    mockGitReset(path, commitHash) {
        const repo = this.repositories.get(path);
        if (!repo) throw new Error('Repository not found');

        const commit = repo.commits.find(c => c.hash === commitHash);
        if (!commit) throw new Error('Commit not found');

        repo.files = new Map(Object.entries(commit.files));
    }

    createMockGitUtils() {
        const mock = {
            isGitRepository: vi.fn().mockImplementation(async path => {
                return this.repositories.has(path);
            }),
            createCommit: vi.fn().mockImplementation(async (path, message, files) => {
                return this.mockGitCommit(path, message, files);
            }),
            createTag: vi.fn().mockImplementation(async (path, tagName, commitHash) => {
                this.mockGitTag(path, tagName, commitHash);
            }),
            getCommit: vi.fn().mockImplementation(async (path, commitHash) => {
                const repo = this.repositories.get(path);
                return repo?.commits.find(c => c.hash === commitHash);
            }),
            resetToCommit: vi.fn().mockImplementation(async (path, commitHash) => {
                this.mockGitReset(path, commitHash);
            }),
            listTags: vi.fn().mockImplementation(async path => {
                const repo = this.repositories.get(path);
                return repo?.tags.map(t => t.name) || [];
            }),
            deleteTag: vi.fn().mockImplementation(async (path, tagName) => {
                const repo = this.repositories.get(path);
                if (repo) {
                    repo.tags = repo.tags.filter(t => t.name !== tagName);
                }
            }),
            getCurrentBranch: vi.fn().mockImplementation(async path => {
                const repo = this.repositories.get(path);
                return repo?.currentBranch || 'main';
            }),
            hasUncommittedChanges: vi.fn().mockImplementation(async path => {
                const repo = this.repositories.get(path);
                return repo ? repo.files.size > 0 : false;
            }),
        };

        return mock;
    }
}
```

### Repository State Mocking

#### Dynamic Repository Mock

```javascript
// tests/snapshot/phase3/mocks/mockRepositoryStates.js
export const repositoryStates = {
    clean: {
        isGitRepository: true,
        hasUncommittedChanges: false,
        currentBranch: 'main',
        commits: 1,
        tags: [],
        files: ['README.md', 'package.json'],
    },

    dirty: {
        isGitRepository: true,
        hasUncommittedChanges: true,
        currentBranch: 'main',
        commits: 5,
        tags: ['snapshot-1', 'snapshot-2'],
        files: ['README.md', 'package.json', 'src.js', 'dist/bundle.js'],
    },

    detached: {
        isGitRepository: true,
        hasUncommittedChanges: false,
        currentBranch: null,
        commits: 3,
        tags: ['snapshot-1'],
        files: ['README.md'],
    },

    empty: {
        isGitRepository: true,
        hasUncommittedChanges: false,
        currentBranch: 'main',
        commits: 0,
        tags: [],
        files: [],
    },

    corrupted: {
        isGitRepository: false,
        error: 'corrupted',
        reason: 'Invalid .git directory',
    },

    noGit: {
        isGitRepository: false,
        error: 'not-found',
        reason: 'Git not installed',
    },
};

export function createRepositoryMock(stateName) {
    const state = repositoryStates[stateName];
    if (!state) throw new Error(`Unknown repository state: ${stateName}`);

    return {
        detectRepository: vi.fn().mockResolvedValue(state),
        validateState: vi.fn().mockResolvedValue(state),
        getStorageMode: vi.fn().mockResolvedValue(state.isGitRepository ? 'git' : 'file'),
    };
}
```

## Test Data Management

### Git Repository Fixtures

#### Pre-configured Repository Fixtures

```javascript
// tests/snapshot/phase3/fixtures/git-repositories/index.js
import { join } from 'path';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';

export const gitFixtures = {
    createCleanRepository: path => {
        execSync('git init', { cwd: path });
        execSync('git config user.email "test@example.com"', { cwd: path });
        execSync('git config user.name "Test User"', { cwd: path });

        writeFileSync(join(path, 'README.md'), '# Clean Repository\n\nTest repository');
        writeFileSync(join(path, 'package.json'), JSON.stringify({ name: 'test-repo' }));

        execSync('git add .', { cwd: path });
        execSync('git commit -m "Initial commit"', { cwd: path });

        return {
            path,
            type: 'clean',
            commits: 1,
            files: 2,
        };
    },

    createDirtyRepository: path => {
        gitFixtures.createCleanRepository(path);

        // Add more files and commits
        mkdirSync(join(path, 'src'), { recursive: true });
        writeFileSync(join(path, 'src', 'index.js'), 'console.log("hello");');
        writeFileSync(join(path, 'src', 'utils.js'), 'export const add = (a, b) => a + b;');

        execSync('git add .', { cwd: path });
        execSync('git commit -m "Add source files"', { cwd: path });

        // Add uncommitted changes
        writeFileSync(join(path, 'src', 'index.js'), 'console.log("hello world");');

        return {
            path,
            type: 'dirty',
            commits: 2,
            files: 4,
            uncommitted: true,
        };
    },

    createDetachedHeadRepository: path => {
        gitFixtures.createCleanRepository(path);

        // Create multiple commits
        writeFileSync(join(path, 'file1.txt'), 'version 1');
        execSync('git add . && git commit -m "Add file1"', { cwd: path });

        writeFileSync(join(path, 'file1.txt'), 'version 2');
        execSync('git add . && git commit -m "Update file1"', { cwd: path });

        // Detach HEAD
        execSync('git checkout HEAD~1', { cwd: path });

        return {
            path,
            type: 'detached',
            commits: 2,
            files: 3,
            detached: true,
        };
    },

    createEmptyRepository: path => {
        execSync('git init', { cwd: path });
        execSync('git config user.email "test@example.com"', { cwd: path });
        execSync('git config user.name "Test User"', { cwd: path });

        return {
            path,
            type: 'empty',
            commits: 0,
            files: 0,
        };
    },
};
```

### Test Configuration Fixtures

#### Git Integration Test Configuration

```javascript
// tests/snapshot/phase3/fixtures/config/gitlab-integration.json
{
    "gitIntegration": {
        "enabled": true,
        "autoDetect": true,
        "storageMode": "auto",
        "testMode": true,
        "repositoryValidation": {
            "checkGitInstallation": true,
            "validateRepositoryState": true,
            "requireCleanWorkingDirectory": false,
            "checkWritePermissions": true,
            "maxValidationTime": 5000
        },
        "snapshotCommit": {
            "format": "TEST-SNAPSHOT: {description} [{timestamp}]",
            "authorName": "Test User",
            "authorEmail": "test@example.com",
            "signCommits": false,
            "includeMetadata": true,
            "testMode": true
        },
        "cleanup": {
            "autoCleanup": false,
            "maxSnapshotCommits": 50,
            "cleanupThreshold": 25,
            "retentionPeriod": "1d",
            "backupBeforeCleanup": true
        },
        "performance": {
            "enableCaching": true,
            "cacheTimeout": 5000,
            "maxCacheSize": 10,
            "testMode": true
        }
    }
}
```

## Test Execution Guidelines

### Phase 3 Test Commands

```bash
# Run all Phase 3 tests
npm test -- tests/snapshot/phase3/

# Run specific test categories
npm test -- tests/snapshot/phase3/unit/
npm test -- tests/snapshot/phase3/integration/
npm test -- tests/snapshot/phase3/e2e/

# Run Git-specific tests
npm test -- tests/snapshot/phase3/unit/git/

# Run storage mode tests
npm test -- tests/snapshot/phase3/integration/storage-mode/

# Run with Git integration coverage
npm run test:coverage -- tests/snapshot/phase3/

# Run with specific Git fixture
TEST_GIT_FIXTURE=clean npm test -- tests/snapshot/phase3/

# Run cross-platform tests
npm test -- tests/snapshot/phase3/e2e/cross-platform/
```

### Debug Commands

```bash
# Debug specific Git test
npx vitest run tests/snapshot/phase3/unit/git/GitSnapshotStore.test.js --reporter=verbose

# Debug with Git logging
DEBUG_GIT=true npm test -- tests/snapshot/phase3/

# Run with real Git operations (integration tests only)
TEST_REAL_GIT=true npm test -- tests/snapshot/phase3/integration/

# Generate test report
npm run test:coverage -- tests/snapshot/phase3/ --reporter=html
```

## Performance Testing

### Git Performance Benchmarks

```javascript
// tests/snapshot/phase3/performance/git-performance.test.js
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';
import GitSnapshotStore from '../../../src/core/snapshot/stores/GitSnapshotStore.js';

describe('Git Performance Tests', () => {
    const performanceThresholds = {
        repositoryDetection: 100, // ms
        commitCreation: 500, // ms
        snapshotRetrieval: 200, // ms
        repositoryCleanup: 1000, // ms
    };

    describe('Performance Benchmarks', () => {
        it('should detect repository within threshold', async () => {
            const start = performance.now();
            await detector.isGitRepository(testPath);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(performanceThresholds.repositoryDetection);
        });

        it('should create snapshot commit within threshold', async () => {
            const start = performance.now();
            await store.createSnapshotCommit(snapshotData, metadata);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(performanceThresholds.commitCreation);
        });

        it('should handle large repositories efficiently', async () => {
            const largeRepo = createLargeRepository(1000);
            const start = performance.now();

            await store.store({ files: largeRepo.files });
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(5000); // 5 seconds for large repos
        });
    });
});
```

## Best Practices

### Test Organization

- **Test Isolation**: Each test creates its own Git repository
- **Cleanup**: Automatic cleanup after each test
- **Mock Hierarchies**: Layered mocking for different test types
- **Fixtures**: Reusable repository states for consistent testing
- **Performance**: Optimized test execution with caching

### Git Testing Guidelines

- **Real vs Mock**: Use real Git for integration tests, mocks for unit tests
- **Cross-Platform**: Test on Windows, macOS, and Linux
- **Edge Cases**: Test corrupted repositories, permission issues, large repos
- **State Management**: Clean state between tests with automatic cleanup
- **Error Handling**: Comprehensive error scenario testing

### Test Data Management

- **Repository Templates**: Pre-configured repository states
- **Dynamic Generation**: Generate test repositories on demand
- **Cleanup Automation**: Automatic cleanup prevents test pollution
- **Performance Optimization**: Efficient test data creation and cleanup
