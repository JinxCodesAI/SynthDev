/**
 * Auto Snapshot Manager for Phase 2 - Automatic Snapshot Creation
 * Main coordinator class that brings together all Phase 2 components
 */

import { getLogger } from '../managers/logger.js';
import { getSnapshotConfigManager } from '../../config/managers/snapshotConfigManager.js';
import { SnapshotManager } from './SnapshotManager.js';
import { ToolMonitor } from './ToolMonitor.js';
import { FileChangeDetector } from './FileChangeDetector.js';
import { SnapshotTrigger } from './SnapshotTrigger.js';
import { InitialSnapshotManager } from './InitialSnapshotManager.js';
import { ToolManagerIntegration } from './ToolManagerIntegration.js';

export class AutoSnapshotManager {
    constructor(toolManager = null) {
        this.logger = getLogger();
        this.configManager = getSnapshotConfigManager();

        // Load Phase 2 configuration
        this.config = this.configManager.getPhase2Config();
        this.enabled = this.config.autoSnapshot.enabled;

        // Core Phase 1 component
        this.snapshotManager = new SnapshotManager();

        // Phase 2 components
        this.toolMonitor = null;
        this.fileChangeDetector = null;
        this.snapshotTrigger = null;
        this.initialSnapshotManager = null;
        this.toolManagerIntegration = null;

        // Tool manager reference
        this.toolManager = toolManager;

        this.logger.debug('AutoSnapshotManager created', {
            enabled: this.enabled,
            hasToolManager: !!toolManager,
        });
    }

    /**
     * Initialize all Phase 2 components
     * @returns {Promise<void>}
     */
    async initialize() {
        if (!this.enabled) {
            this.logger.debug('Auto snapshot system disabled');
            return;
        }

        try {
            this.logger.debug('Initializing Auto Snapshot System...');

            // Initialize components in dependency order
            await this._initializeToolMonitor();
            await this._initializeFileChangeDetector();
            await this._initializeSnapshotTrigger();
            await this._initializeInitialSnapshotManager();
            await this._initializeToolManagerIntegration();

            // Create initial snapshot if enabled
            if (this.config.initialSnapshot.enabled) {
                await this._createInitialSnapshot();
            }

            this.logger.info('✅ Auto Snapshot System initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Auto Snapshot System', error);
            throw error;
        }
    }

    /**
     * Initialize ToolMonitor component
     * @private
     */
    async _initializeToolMonitor() {
        const toolConfig = this.config.toolDeclarations;
        this.toolMonitor = new ToolMonitor(this.toolManager, toolConfig);
        this.logger.debug('ToolMonitor initialized');
    }

    /**
     * Initialize FileChangeDetector component
     * @private
     */
    async _initializeFileChangeDetector() {
        const changeConfig = this.config.fileChangeDetection;
        this.fileChangeDetector = new FileChangeDetector(changeConfig);
        this.logger.debug('FileChangeDetector initialized');
    }

    /**
     * Initialize SnapshotTrigger component
     * @private
     */
    async _initializeSnapshotTrigger() {
        const triggerConfig = {
            ...this.config.triggerRules,
            ...this.config.descriptionGeneration,
        };
        this.snapshotTrigger = new SnapshotTrigger(
            this.snapshotManager,
            this.toolMonitor,
            triggerConfig
        );
        this.logger.debug('SnapshotTrigger initialized');
    }

    /**
     * Initialize InitialSnapshotManager component
     * @private
     */
    async _initializeInitialSnapshotManager() {
        const initialConfig = this.config.initialSnapshot;
        this.initialSnapshotManager = new InitialSnapshotManager(
            this.snapshotManager,
            initialConfig
        );
        this.logger.debug('InitialSnapshotManager initialized');
    }

    /**
     * Initialize ToolManagerIntegration component
     * @private
     */
    async _initializeToolManagerIntegration() {
        const integrationConfig = this.config.integration;
        this.toolManagerIntegration = new ToolManagerIntegration(
            this.snapshotTrigger,
            this.toolMonitor,
            this.fileChangeDetector,
            integrationConfig
        );

        // Integrate with ToolManager if available
        if (this.toolManager) {
            this.toolManagerIntegration.integrateWithToolManager(this.toolManager);
        }

        this.logger.debug('ToolManagerIntegration initialized');
    }

    /**
     * Create initial snapshot if needed
     * @private
     */
    async _createInitialSnapshot() {
        try {
            const basePath = process.cwd();
            const result = await this.initialSnapshotManager.createInitialSnapshot(basePath);

            if (result) {
                this.logger.info(`📸 Initial snapshot created: ${result.id}`);
            }
        } catch (error) {
            this.logger.warn('Failed to create initial snapshot', error);
            // Don't throw - initial snapshot failure shouldn't prevent startup
        }
    }

    /**
     * Integrate with ToolManager
     * @param {Object} toolManager - ToolManager instance
     */
    integrateWithToolManager(toolManager) {
        this.toolManager = toolManager;

        if (this.toolManagerIntegration && toolManager) {
            this.toolManagerIntegration.integrateWithToolManager(toolManager);
            this.logger.debug('Integrated with ToolManager');
        }
    }

    /**
     * Integrate with Application
     * @param {Object} app - Application instance
     */
    integrateWithApplication(app) {
        if (this.toolManagerIntegration && app) {
            this.toolManagerIntegration.setupApplicationStartupHooks(app);
            this.logger.debug('Integrated with Application');
        }
    }

    /**
     * Get system status
     * @returns {Object} System status
     */
    getStatus() {
        return {
            enabled: this.enabled,
            initialized: !!(this.toolMonitor && this.snapshotTrigger),
            components: {
                snapshotManager: !!this.snapshotManager,
                toolMonitor: !!this.toolMonitor,
                fileChangeDetector: !!this.fileChangeDetector,
                snapshotTrigger: !!this.snapshotTrigger,
                initialSnapshotManager: !!this.initialSnapshotManager,
                toolManagerIntegration: !!this.toolManagerIntegration,
            },
            integrations: {
                toolManager: !!this.toolManager,
            },
        };
    }

    /**
     * Get system statistics
     * @returns {Object} System statistics
     */
    getStats() {
        const stats = {
            enabled: this.enabled,
            components: {},
            config: { ...this.config },
        };

        // Collect stats from each component
        if (this.snapshotManager) {
            stats.components.snapshotManager = this.snapshotManager.getSystemStats();
        }

        if (this.toolMonitor) {
            stats.components.toolMonitor = this.toolMonitor.getStats();
        }

        if (this.fileChangeDetector) {
            stats.components.fileChangeDetector = this.fileChangeDetector.getStats();
        }

        if (this.snapshotTrigger) {
            stats.components.snapshotTrigger = this.snapshotTrigger.getStats();
        }

        if (this.initialSnapshotManager) {
            stats.components.initialSnapshotManager = this.initialSnapshotManager.getStats();
        }

        if (this.toolManagerIntegration) {
            stats.components.toolManagerIntegration = this.toolManagerIntegration.getStats();
        }

        return stats;
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.enabled = this.config.autoSnapshot.enabled;

        // Update component configurations
        if (this.toolMonitor && newConfig.toolDeclarations) {
            this.toolMonitor.updateConfiguration(newConfig.toolDeclarations);
        }

        if (this.fileChangeDetector && newConfig.fileChangeDetection) {
            this.fileChangeDetector.updateConfiguration(newConfig.fileChangeDetection);
        }

        if (this.snapshotTrigger && (newConfig.triggerRules || newConfig.descriptionGeneration)) {
            this.snapshotTrigger.updateConfiguration({
                ...newConfig.triggerRules,
                ...newConfig.descriptionGeneration,
            });
        }

        if (this.initialSnapshotManager && newConfig.initialSnapshot) {
            this.initialSnapshotManager.updateConfiguration(newConfig.initialSnapshot);
        }

        if (this.toolManagerIntegration && newConfig.integration) {
            this.toolManagerIntegration.updateConfiguration(newConfig.integration);
        }

        this.logger.debug('AutoSnapshotManager configuration updated');
    }

    /**
     * Enable automatic snapshots
     */
    enable() {
        this.enabled = true;
        this.updateConfiguration({ autoSnapshot: { enabled: true } });
        this.logger.info('Auto snapshots enabled');
    }

    /**
     * Disable automatic snapshots
     */
    disable() {
        this.enabled = false;
        this.updateConfiguration({ autoSnapshot: { enabled: false } });
        this.logger.info('Auto snapshots disabled');
    }

    /**
     * Check if automatic snapshots are enabled
     * @returns {boolean} Whether auto snapshots are enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Manually trigger a snapshot for a tool
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {Promise<Object|null>} Snapshot result
     */
    async manualTrigger(toolName, args = {}, context = {}) {
        if (!this.enabled || !this.snapshotTrigger) {
            return null;
        }

        return await this.snapshotTrigger.forceCreateSnapshot(toolName, args, context);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.toolManagerIntegration) {
            this.toolManagerIntegration.cleanup();
        }

        if (this.initialSnapshotManager) {
            this.initialSnapshotManager.resetInitialState();
        }

        if (this.snapshotTrigger) {
            this.snapshotTrigger.resetSession();
        }

        this.logger.debug('AutoSnapshotManager cleanup completed');
    }

    /**
     * Validate system requirements
     * @returns {Object} Validation result
     */
    async validateRequirements() {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
        };

        try {
            // Check if snapshot manager is working
            if (!this.snapshotManager) {
                validation.valid = false;
                validation.errors.push('SnapshotManager not available');
            }

            // Check initial snapshot requirements if enabled
            if (this.initialSnapshotManager) {
                const initialValidation = await this.initialSnapshotManager.validateRequirements(
                    process.cwd()
                );
                if (!initialValidation.valid) {
                    validation.errors.push(...initialValidation.errors);
                    validation.valid = false;
                }
                validation.warnings.push(...initialValidation.warnings);
            }
        } catch (error) {
            validation.valid = false;
            validation.errors.push(`Validation error: ${error.message}`);
        }

        return validation;
    }
}

export default AutoSnapshotManager;
