import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSnapshotConfigManager } from '../../../src/config/managers/snapshotConfigManager.js';
import { FileFilter } from '../../../src/core/snapshot/FileFilter.js';
import { SnapshotManager } from '../../../src/core/snapshot/SnapshotManager.js';
import { SnapshotsCommand } from '../../../src/commands/snapshots/SnapshotsCommand.js';

describe('Snapshot Configuration Integration', () => {
    let configManager;
    let fileFilter;
    let snapshotManager;
    let snapshotsCommand;

    beforeEach(() => {
        configManager = getSnapshotConfigManager();
        configManager.reloadConfig();

        fileFilter = new FileFilter();
        snapshotManager = new SnapshotManager();
        snapshotsCommand = new SnapshotsCommand();
    });

    afterEach(() => {
        configManager.reloadConfig();
    });

    describe('FileFilter integration', () => {
        it('should use configuration from SnapshotConfigManager', () => {
            const configPatterns = configManager.getFileFilteringConfig().defaultExclusions;
            const filterPatterns = fileFilter.getActivePatterns();

            // Verify that FileFilter is using patterns from configuration
            expect(filterPatterns.length).toBe(configPatterns.length);

            // Verify specific patterns are present
            expect(filterPatterns).toContain('.husky/**');
            expect(filterPatterns).toContain('node_modules/**');
            expect(filterPatterns).toContain('**/node_modules/**');
            expect(filterPatterns).toContain('.git/**');
            expect(filterPatterns).toContain('**/.git/**');
        });

        it('should exclude files according to configuration', () => {
            // Test patterns that should be excluded
            const testPatterns = [
                '.husky/pre-commit',
                '.husky/commit-msg',
                'node_modules/test-package',
                'project/node_modules/test-package',
                '.git/config',
                'project/.git/config',
                'dist/bundle.js',
                'build/output.js',
                '.vscode/settings.json',
                'coverage/lcov.info',
            ];

            testPatterns.forEach(pattern => {
                expect(fileFilter.isExcluded(pattern)).toBe(true);
            });
        });

        it('should not exclude source files', () => {
            const sourceFiles = [
                'src/main.js',
                'lib/utils.js',
                'README.md',
                'package.json',
                'index.js',
                'config/app.js',
            ];

            sourceFiles.forEach(file => {
                expect(fileFilter.isExcluded(file)).toBe(false);
            });
        });

        it('should respect configuration settings', () => {
            const config = configManager.getFileFilteringConfig();

            expect(fileFilter.config.maxFileSize).toBe(config.maxFileSize);
            expect(fileFilter.config.binaryFileHandling).toBe(config.binaryFileHandling);
            expect(fileFilter.config.followSymlinks).toBe(config.followSymlinks);
            expect(fileFilter.config.caseSensitive).toBe(config.caseSensitive);
        });
    });

    describe('SnapshotManager integration', () => {
        it('should use configuration from SnapshotConfigManager', () => {
            const storageConfig = configManager.getStorageConfig();
            const backupConfig = configManager.getBackupConfig();
            const behaviorConfig = configManager.getBehaviorConfig();

            // Verify SnapshotManager is using the configuration
            expect(snapshotManager.config.storage.type).toBe(storageConfig.type);
            expect(snapshotManager.config.storage.maxSnapshots).toBe(storageConfig.maxSnapshots);
            expect(snapshotManager.config.storage.maxMemoryMB).toBe(storageConfig.maxMemoryMB);

            expect(snapshotManager.config.backup.preservePermissions).toBe(
                backupConfig.preservePermissions
            );

            expect(snapshotManager.config.behavior.autoCleanup).toBe(behaviorConfig.autoCleanup);
            expect(snapshotManager.config.behavior.cleanupThreshold).toBe(
                behaviorConfig.cleanupThreshold
            );
            expect(snapshotManager.config.behavior.confirmRestore).toBe(
                behaviorConfig.confirmRestore
            );
        });

        it('should use configured file filtering', () => {
            const filterStats = snapshotManager.getSystemStats().filtering;
            const configPatterns = configManager.getFileFilteringConfig().defaultExclusions;

            expect(filterStats.totalPatterns).toBe(configPatterns.length);
            expect(filterStats.maxFileSize).toBe(
                configManager.getFileFilteringConfig().maxFileSize
            );
            expect(filterStats.binaryFileHandling).toBe(
                configManager.getFileFilteringConfig().binaryFileHandling
            );
        });
    });

    describe('SnapshotsCommand integration', () => {
        it('should use configured messages', () => {
            const messagesConfig = configManager.getMessagesConfig();

            // Verify command has access to messages
            expect(snapshotsCommand.messages).toBeDefined();
            expect(snapshotsCommand.messages.success).toBeDefined();
            expect(snapshotsCommand.messages.info).toBeDefined();
            expect(snapshotsCommand.messages.errors).toBeDefined();
            expect(snapshotsCommand.messages.prompts).toBeDefined();

            // Verify specific messages match configuration
            expect(snapshotsCommand.messages.success.snapshotCreated).toBe(
                messagesConfig.success.snapshotCreated
            );
            expect(snapshotsCommand.messages.success.snapshotRestored).toBe(
                messagesConfig.success.snapshotRestored
            );
            expect(snapshotsCommand.messages.success.snapshotDeleted).toBe(
                messagesConfig.success.snapshotDeleted
            );

            expect(snapshotsCommand.messages.info.scanningFiles).toBe(
                messagesConfig.info.scanningFiles
            );
            expect(snapshotsCommand.messages.info.analyzingRestore).toBe(
                messagesConfig.info.analyzingRestore
            );
            expect(snapshotsCommand.messages.info.restoringFiles).toBe(
                messagesConfig.info.restoringFiles
            );

            expect(snapshotsCommand.messages.prompts.snapshotDescription).toBe(
                messagesConfig.prompts.snapshotDescription
            );
            expect(snapshotsCommand.messages.prompts.confirmRestore).toBe(
                messagesConfig.prompts.confirmRestore
            );
            expect(snapshotsCommand.messages.prompts.confirmDelete).toBe(
                messagesConfig.prompts.confirmDelete
            );
        });
    });

    describe('configuration consistency', () => {
        it('should maintain consistent configuration across all components', () => {
            // Get configuration from all sources
            const configManagerSettings = configManager.getConfig();
            const fileFilterSettings = fileFilter.config;
            const snapshotManagerSettings = snapshotManager.config;

            // Verify file filtering settings are consistent
            expect(fileFilterSettings.maxFileSize).toBe(
                configManagerSettings.fileFiltering.maxFileSize
            );
            expect(fileFilterSettings.binaryFileHandling).toBe(
                configManagerSettings.fileFiltering.binaryFileHandling
            );
            expect(fileFilterSettings.followSymlinks).toBe(
                configManagerSettings.fileFiltering.followSymlinks
            );
            expect(fileFilterSettings.caseSensitive).toBe(
                configManagerSettings.fileFiltering.caseSensitive
            );

            // Verify snapshot manager settings are consistent
            expect(snapshotManagerSettings.storage.type).toBe(configManagerSettings.storage.type);
            expect(snapshotManagerSettings.storage.maxSnapshots).toBe(
                configManagerSettings.storage.maxSnapshots
            );
            expect(snapshotManagerSettings.storage.maxMemoryMB).toBe(
                configManagerSettings.storage.maxMemoryMB
            );

            expect(snapshotManagerSettings.backup.preservePermissions).toBe(
                configManagerSettings.backup.preservePermissions
            );
            expect(snapshotManagerSettings.backup.preservePermissions).toBe(
                configManagerSettings.backup.preservePermissions
            );

            expect(snapshotManagerSettings.behavior.autoCleanup).toBe(
                configManagerSettings.behavior.autoCleanup
            );
            expect(snapshotManagerSettings.behavior.cleanupThreshold).toBe(
                configManagerSettings.behavior.cleanupThreshold
            );
            expect(snapshotManagerSettings.behavior.confirmRestore).toBe(
                configManagerSettings.behavior.confirmRestore
            );
        });
    });

    describe('configuration changes', () => {
        it('should propagate configuration changes to all components', () => {
            // Add a custom exclusion pattern
            configManager.addCustomExclusion('test-integration/**');

            // Create new instances to pick up the change
            const newFileFilter = new FileFilter();

            // Verify the new pattern is being used
            expect(newFileFilter.isExcluded('test-integration/file.js')).toBe(true);
            expect(configManager.testExclusion('test-integration/file.js')).toBe(true);
        });
    });

    describe('real-world patterns', () => {
        it('should handle common project patterns correctly', () => {
            const testCases = [
                // Should be excluded
                { path: '.husky/pre-commit', expected: true, reason: 'Husky git hooks' },
                { path: '.husky/commit-msg', expected: true, reason: 'Husky git hooks' },
                { path: 'node_modules/react/index.js', expected: true, reason: 'Node modules' },
                {
                    path: 'project/node_modules/lodash/index.js',
                    expected: true,
                    reason: 'Nested node modules',
                },
                { path: 'dist/bundle.js', expected: true, reason: 'Build artifacts' },
                { path: 'build/main.js', expected: true, reason: 'Build artifacts' },
                { path: '.git/config', expected: true, reason: 'Git files' },
                {
                    path: 'project/.git/hooks/pre-commit',
                    expected: true,
                    reason: 'Nested git files',
                },
                { path: '.vscode/settings.json', expected: true, reason: 'IDE files' },
                { path: '.idea/workspace.xml', expected: true, reason: 'IDE files' },
                { path: 'coverage/lcov.info', expected: true, reason: 'Coverage reports' },
                { path: '.env', expected: true, reason: 'Environment files' },
                { path: '.env.local', expected: true, reason: 'Environment files' },
                { path: 'temp.log', expected: true, reason: 'Log files' },
                { path: 'cache.tmp', expected: true, reason: 'Temporary files' },

                // Should be included
                { path: 'src/main.js', expected: false, reason: 'Source files' },
                { path: 'lib/utils.js', expected: false, reason: 'Library files' },
                { path: 'README.md', expected: false, reason: 'Documentation' },
                { path: 'package.json', expected: false, reason: 'Package files' },
                { path: 'tsconfig.json', expected: false, reason: 'Config files' },
                { path: 'index.html', expected: false, reason: 'HTML files' },
                { path: 'styles/main.css', expected: false, reason: 'CSS files' },
                { path: 'tests/unit/test.js', expected: false, reason: 'Test files' },
                { path: 'docs/guide.md', expected: false, reason: 'Documentation' },
                { path: 'config/app.js', expected: false, reason: 'App config' },
            ];

            testCases.forEach(({ path, expected, reason }) => {
                const result = fileFilter.isExcluded(path);
                expect(
                    result,
                    `${path} should ${expected ? 'be excluded' : 'be included'} (${reason})`
                ).toBe(expected);
            });
        });
    });
});
