import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration fixture manager for tests
 * Provides controlled, predictable configurations for different test scenarios
 */
export class ConfigFixtures {
    constructor() {
        this.fixturesDir = join(__dirname, '..', 'e2e', 'fixtures');
        this.originalConfigs = new Map();
        this.activeFixtures = new Set();
    }

    /**
     * Available fixture configurations
     */
    static get FIXTURES() {
        return {
            AUTO_SNAPSHOT_ENABLED: 'auto-snapshot-enabled.json',
            AUTO_SNAPSHOT_DISABLED: 'auto-snapshot-disabled.json',
            AUTO_SNAPSHOT_MANUAL_ONLY: 'auto-snapshot-manual-only.json',
        };
    }

    /**
     * Load a fixture configuration
     * @param {string} fixtureName - Name of the fixture file
     * @returns {Object} Configuration object
     */
    loadFixture(fixtureName) {
        const fixturePath = join(this.fixturesDir, fixtureName);

        if (!existsSync(fixturePath)) {
            throw new Error(`Fixture not found: ${fixturePath}`);
        }

        try {
            const content = readFileSync(fixturePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load fixture ${fixtureName}: ${error.message}`);
        }
    }

    /**
     * Apply a fixture configuration to the auto-snapshot system
     * @param {string} fixtureName - Name of the fixture to apply
     * @param {string} targetConfigPath - Path to the config file to override
     * @returns {Function} Cleanup function to restore original configuration
     */
    applyFixture(fixtureName, targetConfigPath) {
        const fixture = this.loadFixture(fixtureName);

        // Backup original configuration if not already backed up
        if (!this.originalConfigs.has(targetConfigPath)) {
            if (existsSync(targetConfigPath)) {
                const originalContent = readFileSync(targetConfigPath, 'utf8');
                this.originalConfigs.set(targetConfigPath, originalContent);
            } else {
                this.originalConfigs.set(targetConfigPath, null);
            }
        }

        // Apply fixture configuration
        writeFileSync(targetConfigPath, JSON.stringify(fixture, null, 4));
        this.activeFixtures.add(targetConfigPath);

        // Return cleanup function
        return () => this.restoreOriginal(targetConfigPath);
    }

    /**
     * Restore original configuration for a specific path
     * @param {string} targetConfigPath - Path to restore
     */
    restoreOriginal(targetConfigPath) {
        if (this.originalConfigs.has(targetConfigPath)) {
            const originalContent = this.originalConfigs.get(targetConfigPath);

            if (originalContent !== null) {
                writeFileSync(targetConfigPath, originalContent);
            } else if (existsSync(targetConfigPath)) {
                // Original file didn't exist, remove the created one
                // Note: In a real implementation, you might want to use fs.unlinkSync
                // but for safety in tests, we'll just restore to empty
                writeFileSync(targetConfigPath, '{}');
            }

            this.originalConfigs.delete(targetConfigPath);
            this.activeFixtures.delete(targetConfigPath);
        }
    }

    /**
     * Restore all original configurations
     */
    restoreAll() {
        for (const configPath of this.activeFixtures) {
            this.restoreOriginal(configPath);
        }
    }

    /**
     * Create a mock configuration manager that uses fixture data
     * @param {string} fixtureName - Name of the fixture to use
     * @returns {Object} Mock configuration manager
     */
    createMockConfigManager(fixtureName) {
        const fixture = this.loadFixture(fixtureName);

        // Create Phase 1 compatible structure
        const phase1Config = {
            fileFiltering: {
                defaultExclusions: ['node_modules/**', '.git/**'],
                customExclusions: [],
                maxFileSize: 10 * 1024 * 1024,
                binaryFileHandling: 'exclude',
                followSymlinks: false,
                caseSensitive: false,
            },
            storage: { type: 'memory', maxSnapshots: 50, maxMemoryMB: 100, persistToDisk: false },
            backup: { encoding: 'utf8', preservePermissions: true, validateChecksums: true },
            behavior: { autoCleanup: false, confirmRestore: true },
            messages: { success: {}, errors: {}, info: {} },
            phase2: fixture,
        };

        return {
            // Phase 1 methods
            getConfig: () => phase1Config,
            getFileFilteringConfig: () => phase1Config.fileFiltering,
            getStorageConfig: () => phase1Config.storage,
            getBackupConfig: () => phase1Config.backup,
            getBehaviorConfig: () => phase1Config.behavior,
            getMessagesConfig: () => phase1Config.messages,

            // Phase 2 methods - this is what AutoSnapshotManager uses
            getPhase2Config: () => fixture,
            getAutoSnapshotConfig: () => fixture.autoSnapshot,
            getToolDeclarations: () => fixture.toolDeclarations,
            getTriggerRules: () => fixture.triggerRules,
            getDescriptionGeneration: () => fixture.descriptionGeneration,
            getFileChangeDetection: () => fixture.fileChangeDetection,
            getInitialSnapshot: () => fixture.initialSnapshot,
            getIntegration: () => fixture.integration,
            getPerformance: () => fixture.performance,

            // Utility methods
            reloadConfig: () => phase1Config,
            isEnabled: () => fixture.autoSnapshot.enabled,
            loadConfig: () => phase1Config,
        };
    }

    /**
     * Get the default auto-snapshot config path
     * @returns {string} Path to the auto-snapshot defaults file
     */
    static getAutoSnapshotConfigPath() {
        return join(process.cwd(), 'src', 'config', 'snapshots', 'auto-snapshot-defaults.json');
    }
}

/**
 * Convenience function to create a fixture manager
 * @returns {ConfigFixtures} New fixture manager instance
 */
export function createConfigFixtures() {
    return new ConfigFixtures();
}

/**
 * Convenience function to apply a fixture for auto-snapshot configuration
 * @param {string} fixtureName - Name of the fixture to apply
 * @returns {Function} Cleanup function
 */
export function applyAutoSnapshotFixture(fixtureName) {
    const fixtures = new ConfigFixtures();
    const configPath = ConfigFixtures.getAutoSnapshotConfigPath();
    return fixtures.applyFixture(fixtureName, configPath);
}
