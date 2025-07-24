/**
 * Snapshot Trigger for Phase 2 - Automatic Snapshot Creation
 * Coordinates automatic snapshot creation based on tool execution
 */

import { getLogger } from '../managers/logger.js';

export class SnapshotTrigger {
    constructor(snapshotManager, toolMonitor, config = {}) {
        this.snapshotManager = snapshotManager;
        this.toolMonitor = toolMonitor;
        this.config = {
            // Trigger configuration
            enabled: true,
            createOnToolExecution: true,
            maxSnapshotsPerSession: 20,
            cooldownPeriod: 5000, // 5 seconds
            requireActualChanges: false, // If true, only create snapshots when files actually change

            // Description generation
            maxDescriptionLength: 100,
            includeToolName: true,
            includeTargetFiles: true,
            includeTimestamp: false,

            ...config,
        };

        this.logger = getLogger();

        // Track state
        this.sessionSnapshots = 0;
        this.lastSnapshotTime = 0;
        this.activeOperations = new Map();

        this.logger.debug('SnapshotTrigger initialized', { config: this.config });
    }

    /**
     * Process a trigger event for potential snapshot creation
     * @param {string} toolName - Name of the tool being executed
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {Promise<Object|null>} Snapshot result or null if no snapshot created
     */
    async processTrigger(toolName, args = {}, context = {}) {
        try {
            if (!this.config.enabled) {
                this.logger.debug(`Snapshot trigger disabled, skipping ${toolName}`);
                return null;
            }

            // Check if we should create a snapshot for this tool
            if (!this._shouldTriggerSnapshot(toolName, args, context)) {
                return null;
            }

            // Create the triggered snapshot
            return await this.createTriggeredSnapshot(toolName, args, context);
        } catch (error) {
            this.logger.error(`Failed to process trigger for ${toolName}`, error);
            throw error;
        }
    }

    /**
     * Create a triggered snapshot
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Snapshot result
     */
    async createTriggeredSnapshot(toolName, args = {}, context = {}) {
        try {
            const description = this.generateSnapshotDescription(toolName, args);
            const metadata = this.createToolMetadata(toolName, args, context);

            this.logger.debug(`Creating triggered snapshot for ${toolName}`, {
                description,
                metadata: { ...metadata, arguments: '[hidden]' },
            });

            // Create snapshot using SnapshotManager
            const result = await this.snapshotManager.createSnapshot(description, metadata);

            // Update session tracking
            this.sessionSnapshots++;
            this.lastSnapshotTime = Date.now();

            this.logger.debug('Triggered snapshot created successfully', {
                id: result.id,
                toolName,
                sessionCount: this.sessionSnapshots,
            });

            return result;
        } catch (error) {
            this.logger.error(`Failed to create triggered snapshot for ${toolName}`, error);
            throw error;
        }
    }

    /**
     * Determine if a snapshot should be triggered
     * @private
     */
    _shouldTriggerSnapshot(toolName, args, context) {
        // Check if tool should create snapshots
        if (!this.toolMonitor.shouldCreateSnapshot(toolName)) {
            this.logger.debug(`Tool ${toolName} does not require snapshot`);
            return false;
        }

        // Check session limits
        if (this.sessionSnapshots >= this.config.maxSnapshotsPerSession) {
            this.logger.warn(
                `Session snapshot limit reached (${this.config.maxSnapshotsPerSession}), skipping ${toolName}`
            );
            return false;
        }

        // Check cooldown period
        const timeSinceLastSnapshot = Date.now() - this.lastSnapshotTime;
        if (timeSinceLastSnapshot < this.config.cooldownPeriod) {
            this.logger.debug(
                `Cooldown period active (${timeSinceLastSnapshot}ms < ${this.config.cooldownPeriod}ms), skipping ${toolName}`
            );
            return false;
        }

        return true;
    }

    /**
     * Generate a meaningful snapshot description
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     * @returns {string} Generated description
     */
    generateSnapshotDescription(toolName, args = {}) {
        let description = '';

        // Start with tool name if enabled
        if (this.config.includeToolName) {
            description = `Before ${toolName}`;
        } else {
            description = 'Automatic snapshot';
        }

        // Add target files if enabled and available
        if (this.config.includeTargetFiles) {
            const fileTargets = this.toolMonitor.extractFileTargets(toolName, args);
            if (fileTargets.length > 0) {
                const fileList = fileTargets.slice(0, 3).join(', ');
                const moreFiles =
                    fileTargets.length > 3 ? ` and ${fileTargets.length - 3} more` : '';
                description += `: ${fileList}${moreFiles}`;
            }
        }

        // Add timestamp if enabled
        if (this.config.includeTimestamp) {
            const now = new Date();
            const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            description += ` (${timestamp})`;
        }

        // Truncate if too long
        if (description.length > this.config.maxDescriptionLength) {
            description = `${description.substring(0, this.config.maxDescriptionLength - 3)}...`;
        }

        return description;
    }

    /**
     * Create tool metadata for the snapshot
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {Object} Tool metadata
     */
    createToolMetadata(toolName, args = {}, context = {}) {
        const toolMetadata = this.toolMonitor.getToolMetadata(toolName, args);

        return {
            triggerType: 'automatic',
            toolName,
            toolMetadata,
            arguments: args,
            sessionSnapshot: this.sessionSnapshots + 1,
            triggerTime: Date.now(),
            context: {
                basePath: context.basePath || process.cwd(),
                ...context,
            },
        };
    }

    /**
     * Hook for before tool execution
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {Promise<Object|null>} Snapshot result or null
     */
    async onToolExecution(toolName, args, context) {
        this.logger.debug(`Tool execution hook: ${toolName}`);
        return await this.processTrigger(toolName, args, context);
    }

    /**
     * Hook for after tool execution completion
     * @param {string} toolName - Name of the tool
     * @param {Object} results - Tool execution results
     * @param {Object} context - Execution context
     * @returns {Promise<void>}
     */
    async onExecutionComplete(toolName, results, context) {
        this.logger.debug(`Tool execution completed: ${toolName}`, {
            success: results?.success,
            hasErrors: !!results?.error,
        });

        // Here we could implement post-execution validation
        // For example, check if the tool actually modified files as expected

        // Clean up any active operations tracking
        if (this.activeOperations.has(toolName)) {
            this.activeOperations.delete(toolName);
        }
    }

    /**
     * Hook for application start
     * @param {Object} context - Application context
     * @returns {Promise<void>}
     */
    async onApplicationStart(context) {
        this.logger.debug('Application started, resetting session state');

        // Reset session state
        this.sessionSnapshots = 0;
        this.lastSnapshotTime = 0;
        this.activeOperations.clear();
    }

    /**
     * Check if a snapshot should be skipped
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {boolean} Whether to skip snapshot
     */
    shouldSkipSnapshot(toolName, args, context) {
        // Already checked in _shouldTriggerSnapshot, but this is for external use
        return !this._shouldTriggerSnapshot(toolName, args, context);
    }

    /**
     * Reset session state
     */
    resetSession() {
        this.logger.debug('Resetting snapshot trigger session state');
        this.sessionSnapshots = 0;
        this.lastSnapshotTime = 0;
        this.activeOperations.clear();
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.debug('SnapshotTrigger configuration updated', { config: this.config });
    }

    /**
     * Get trigger statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            sessionSnapshots: this.sessionSnapshots,
            lastSnapshotTime: this.lastSnapshotTime,
            activeOperations: this.activeOperations.size,
            config: { ...this.config },
            timeSinceLastSnapshot: this.lastSnapshotTime
                ? Date.now() - this.lastSnapshotTime
                : null,
        };
    }

    /**
     * Check if trigger is currently in cooldown
     * @returns {boolean} Whether in cooldown
     */
    isInCooldown() {
        if (!this.lastSnapshotTime) {
            return false;
        }

        const timeSinceLastSnapshot = Date.now() - this.lastSnapshotTime;
        return timeSinceLastSnapshot < this.config.cooldownPeriod;
    }

    /**
     * Get remaining cooldown time in milliseconds
     * @returns {number} Remaining cooldown time
     */
    getRemainingCooldown() {
        if (!this.isInCooldown()) {
            return 0;
        }

        const timeSinceLastSnapshot = Date.now() - this.lastSnapshotTime;
        return this.config.cooldownPeriod - timeSinceLastSnapshot;
    }

    /**
     * Force create a snapshot regardless of cooldown or limits
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Snapshot result
     */
    async forceCreateSnapshot(toolName, args = {}, context = {}) {
        this.logger.debug(`Force creating snapshot for ${toolName}`);
        return await this.createTriggeredSnapshot(toolName, args, context);
    }
}

export default SnapshotTrigger;
