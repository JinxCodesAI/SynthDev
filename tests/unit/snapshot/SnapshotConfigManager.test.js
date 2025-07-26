import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSnapshotConfigManager } from '../../../src/config/managers/snapshotConfigManager.js';

describe('SnapshotConfigManager', () => {
    let configManager;

    beforeEach(() => {
        configManager = getSnapshotConfigManager();
        // Clear any cached config
        configManager.reloadConfig();
    });

    afterEach(() => {
        // Clean up any modifications
        configManager.reloadConfig();
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = getSnapshotConfigManager();
            const instance2 = getSnapshotConfigManager();

            expect(instance1).toBe(instance2);
        });
    });

    describe('configuration loading', () => {
        it('should load configuration from files', () => {
            const config = configManager.getConfig();

            expect(config).toBeDefined();
            expect(config.fileFiltering).toBeDefined();
            expect(config.storage).toBeDefined();
            expect(config.backup).toBeDefined();
            expect(config.behavior).toBeDefined();
            expect(config.messages).toBeDefined();
        });

        it('should load file filtering configuration', () => {
            const fileFilteringConfig = configManager.getFileFilteringConfig();

            expect(fileFilteringConfig).toBeDefined();
            expect(fileFilteringConfig.defaultExclusions).toBeDefined();
            expect(Array.isArray(fileFilteringConfig.defaultExclusions)).toBe(true);
            expect(fileFilteringConfig.defaultExclusions.length).toBeGreaterThan(0);

            // Verify .husky/** is included
            expect(fileFilteringConfig.defaultExclusions).toContain('.husky/**');

            // Verify node_modules patterns are included
            expect(fileFilteringConfig.defaultExclusions).toContain('node_modules/**');
            expect(fileFilteringConfig.defaultExclusions).toContain('**/node_modules/**');

            // Verify other required patterns
            expect(fileFilteringConfig.defaultExclusions).toContain('.git/**');
            expect(fileFilteringConfig.defaultExclusions).toContain('dist/**');
            expect(fileFilteringConfig.defaultExclusions).toContain('build/**');
        });

        it('should load storage configuration', () => {
            const storageConfig = configManager.getStorageConfig();

            expect(storageConfig).toBeDefined();
            expect(storageConfig.type).toBe('memory');
            expect(storageConfig.maxSnapshots).toBe(50);
            expect(storageConfig.maxMemoryMB).toBe(100);
            expect(storageConfig.persistToDisk).toBe(false);
        });

        it('should load backup configuration', () => {
            const backupConfig = configManager.getBackupConfig();

            expect(backupConfig).toBeDefined();
            expect(backupConfig.preservePermissions).toBe(true);
            expect(backupConfig.validateChecksums).toBe(true);
            expect(backupConfig.maxConcurrentFiles).toBe(10);
            expect(backupConfig.encoding).toBe('utf8');
        });

        it('should load behavior configuration', () => {
            const behaviorConfig = configManager.getBehaviorConfig();

            expect(behaviorConfig).toBeDefined();
            expect(behaviorConfig.autoCleanup).toBe(true);
            expect(behaviorConfig.cleanupThreshold).toBe(40);
            expect(behaviorConfig.confirmRestore).toBe(true);
            expect(behaviorConfig.showPreview).toBe(true);
        });

        it('should load messages configuration', () => {
            const messagesConfig = configManager.getMessagesConfig();

            expect(messagesConfig).toBeDefined();
            expect(messagesConfig.success).toBeDefined();
            expect(messagesConfig.info).toBeDefined();
            expect(messagesConfig.warnings).toBeDefined();
            expect(messagesConfig.errors).toBeDefined();
            expect(messagesConfig.prompts).toBeDefined();
            expect(messagesConfig.help).toBeDefined();

            // Verify specific message contents
            expect(messagesConfig.success.snapshotCreated).toBe(
                '✅ Snapshot created successfully!'
            );
            expect(messagesConfig.success.snapshotRestored).toBe(
                '✅ Snapshot restored successfully!'
            );
            expect(messagesConfig.success.snapshotDeleted).toBe(
                '✅ Snapshot deleted successfully!'
            );

            expect(messagesConfig.info.scanningFiles).toBe('📂 Scanning and capturing files...');
            expect(messagesConfig.info.analyzingRestore).toBe('🔍 Analyzing restoration impact...');
            expect(messagesConfig.info.restoringFiles).toBe('🔄 Restoring files...');

            expect(messagesConfig.prompts.snapshotDescription).toBe('Enter snapshot description: ');
            expect(messagesConfig.prompts.confirmRestore).toBe(
                'Do you want to proceed with the restoration?'
            );
            expect(messagesConfig.prompts.confirmDelete).toBe(
                'Are you sure you want to delete this snapshot? This action cannot be undone.'
            );
        });
    });

    describe('pattern testing', () => {
        it('should correctly test exclusion patterns', () => {
            // Test .husky patterns
            expect(configManager.testExclusion('.husky/pre-commit')).toBe(true);
            expect(configManager.testExclusion('.husky/commit-msg')).toBe(true);
            expect(configManager.testExclusion('project/.husky/pre-commit')).toBe(true);

            // Test node_modules patterns
            expect(configManager.testExclusion('node_modules/test')).toBe(true);
            expect(configManager.testExclusion('project/node_modules/test')).toBe(true);
            expect(configManager.testExclusion('deep/project/node_modules/test')).toBe(true);

            // Test .git patterns
            expect(configManager.testExclusion('.git/config')).toBe(true);
            expect(configManager.testExclusion('project/.git/config')).toBe(true);

            // Test build artifacts
            expect(configManager.testExclusion('dist/bundle.js')).toBe(true);
            expect(configManager.testExclusion('build/output.js')).toBe(true);

            // Test that source files are not excluded
            expect(configManager.testExclusion('src/main.js')).toBe(false);
            expect(configManager.testExclusion('lib/utils.js')).toBe(false);
            expect(configManager.testExclusion('README.md')).toBe(false);
            expect(configManager.testExclusion('package.json')).toBe(false);
        });
    });

    describe('custom exclusion management', () => {
        it('should add custom exclusion patterns', () => {
            const originalCount = configManager.getFileFilteringConfig().customExclusions.length;

            configManager.addCustomExclusion('custom-pattern/**');

            const newCount = configManager.getFileFilteringConfig().customExclusions.length;
            expect(newCount).toBe(originalCount + 1);

            expect(configManager.testExclusion('custom-pattern/file.js')).toBe(true);
        });

        it('should not add duplicate custom exclusion patterns', () => {
            configManager.addCustomExclusion('duplicate-pattern/**');
            const countAfterFirst = configManager.getFileFilteringConfig().customExclusions.length;

            configManager.addCustomExclusion('duplicate-pattern/**');
            const countAfterSecond = configManager.getFileFilteringConfig().customExclusions.length;

            expect(countAfterSecond).toBe(countAfterFirst);
        });

        it('should remove custom exclusion patterns', () => {
            configManager.addCustomExclusion('removable-pattern/**');
            expect(configManager.testExclusion('removable-pattern/file.js')).toBe(true);

            configManager.removeCustomExclusion('removable-pattern/**');
            expect(configManager.testExclusion('removable-pattern/file.js')).toBe(false);
        });
    });

    describe('configuration reloading', () => {
        it('should reload configuration when requested', () => {
            // Get original custom exclusions count
            const originalCustomExclusions =
                configManager.getFileFilteringConfig().customExclusions.length;

            // Modify the config
            configManager.addCustomExclusion('test-reload-pattern/**');

            // Verify modification was applied
            const modifiedCustomExclusions =
                configManager.getFileFilteringConfig().customExclusions.length;
            expect(modifiedCustomExclusions).toBe(originalCustomExclusions + 1);

            // Reload should reset the config
            const reloadedConfig = configManager.reloadConfig();

            expect(reloadedConfig).toBeDefined();
            expect(reloadedConfig.fileFiltering.customExclusions.length).toBe(
                originalCustomExclusions
            );
        });
    });

    describe('fallback configuration', () => {
        it('should provide fallback configuration if files cannot be loaded', () => {
            // This test is more difficult to implement without mocking the file system
            // For now, we'll just verify that the fallback method exists and returns valid config
            const fallbackConfig = configManager._getFallbackConfig();

            expect(fallbackConfig).toBeDefined();
            expect(fallbackConfig.fileFiltering).toBeDefined();
            expect(fallbackConfig.storage).toBeDefined();
            expect(fallbackConfig.backup).toBeDefined();
            expect(fallbackConfig.behavior).toBeDefined();
            expect(fallbackConfig.messages).toBeDefined();

            // Verify fallback has essential patterns
            expect(fallbackConfig.fileFiltering.defaultExclusions).toContain('node_modules/**');
            expect(fallbackConfig.fileFiltering.defaultExclusions).toContain('.git/**');
            expect(fallbackConfig.fileFiltering.defaultExclusions).toContain('dist/**');
        });
    });
});
