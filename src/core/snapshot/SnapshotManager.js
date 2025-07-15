/**
 * Snapshot Manager - Main Orchestrator for Snapshot Operations
 * Coordinates all snapshot operations and manages the overall system state
 */

import { StrategyFactory } from './strategies/StrategyFactory.js';
import SnapshotConfig from './SnapshotConfig.js';
import SnapshotEventEmitter from './events/SnapshotEventEmitter.js';
import { SnapshotEvents } from './events/SnapshotEvents.js';
import SnapshotLogger from './utils/SnapshotLogger.js';
import ContentChangeDetector from './utils/ContentChangeDetector.js';
import SnapshotIntegrityValidator from './validation/SnapshotIntegrityValidator.js';
import PerformanceOptimizer from './utils/PerformanceOptimizer.js';

/**
 * Main orchestrator class that coordinates all snapshot operations
 * and manages the overall system state
 */
export class SnapshotManager {
    constructor(config = null, eventEmitter = null) {
        this.config = config || new SnapshotConfig();
        this.eventEmitter = eventEmitter || new SnapshotEventEmitter();
        this.logger = new SnapshotLogger('SnapshotManager');

        // Core components
        this.strategyFactory = new StrategyFactory(this.config, this.eventEmitter);
        this.changeDetector = new ContentChangeDetector(this.config);
        this.integrityValidator = new SnapshotIntegrityValidator(this.config);
        this.performanceOptimizer = new PerformanceOptimizer(this.config);

        // State management
        this.isInitialized = false;
        this.currentStrategy = null;
        this.operationQueue = [];
        this.activeOperations = new Map();
        this.systemHealth = {
            status: 'unknown',
            lastCheck: null,
            issues: [],
        };

        // Concurrency control (simplified)
        this.operationLock = new Map(); // resourceId -> Promise
        this.maxConcurrentOperations = 5;
        this.operationTimeout = 5000; // 5 seconds

        // Performance metrics
        this.metrics = {
            totalSnapshots: 0,
            totalOperations: 0,
            averageOperationTime: 0,
            errorRate: 0,
            lastOperationTime: null,
        };

        // Event listeners
        this._setupEventListeners();
    }

    /**
     * Initialize the snapshot manager and underlying systems
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async initialize() {
        const timer = this.logger.createTimer('initialize_manager');

        try {
            this.logger.info('Initializing snapshot manager...');

            // Initialize strategy factory
            const strategyResult = await this.strategyFactory.initialize();
            if (!strategyResult.success) {
                timer(false, { error: strategyResult.error });
                return { success: false, error: strategyResult.error };
            }

            this.currentStrategy = this.strategyFactory.getCurrentStrategy();

            // Initialize change detector if it has an initialize method
            if (this.changeDetector && typeof this.changeDetector.initialize === 'function') {
                await this.changeDetector.initialize();
            }

            // Initialize performance optimizer if it has an initialize method
            if (
                this.performanceOptimizer &&
                typeof this.performanceOptimizer.initialize === 'function'
            ) {
                await this.performanceOptimizer.initialize();
            }

            // Perform initial health check
            await this._performHealthCheck();

            this.isInitialized = true;
            timer(true);

            this.eventEmitter.emit(SnapshotEvents.MANAGER_INITIALIZED, {
                strategy: this.currentStrategy.getMode(),
                health: this.systemHealth,
            });

            this.logger.info('Snapshot manager initialized successfully');
            return { success: true };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to initialize snapshot manager: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create a new snapshot with the given instruction and files
     * @param {string} instruction - Human-readable description of the snapshot
     * @param {Map<string, string>|Array<string>|null} files - Files to include (optional)
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, snapshot?: Snapshot, error?: string}>}
     */
    async createSnapshot(instruction, files = null, options = {}) {
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return { success: false, error: initResult.error };
            }
        }

        const operationId = this._generateOperationId();
        const timer = this.logger.createTimer('create_snapshot');

        try {
            // Acquire operation lock
            await this._acquireOperationLock('create', operationId);

            this.logger.info(`Creating snapshot: ${instruction}`);

            // Validate inputs
            const validationResult = this._validateSnapshotInputs(instruction, files, options);
            if (!validationResult.valid) {
                timer(false, { error: validationResult.error });
                return { success: false, error: validationResult.error };
            }

            // Create snapshot using current strategy
            const result = await this.currentStrategy.createSnapshot(instruction, files, options);

            if (result.success) {
                // Update metrics
                this._updateMetrics('create', timer(true));

                // Emit success event
                this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_CREATED, {
                    snapshot: result.snapshot,
                    strategy: this.currentStrategy.getMode(),
                    operationId,
                });

                this.logger.info(`Snapshot created successfully: ${result.snapshot.id}`);
            } else {
                timer(false, { error: result.error });
                this._updateMetrics('create', null, true);
            }

            return result;
        } catch (error) {
            timer(false, { error: error.message });
            this._updateMetrics('create', null, true);
            this.logger.error(`Failed to create snapshot: ${error.message}`);
            return { success: false, error: error.message };
        } finally {
            this._releaseOperationLock('create', operationId);
        }
    }

    /**
     * Get snapshots with optional filtering and pagination
     * @param {Object} options - Query options
     * @returns {Promise<{success: boolean, snapshots?: Array, error?: string}>}
     */
    async getSnapshots(options = {}) {
        if (!this.isInitialized) {
            return { success: false, error: 'Snapshot manager not initialized' };
        }

        const timer = this.logger.createTimer('get_snapshots');

        try {
            const result = await this.currentStrategy.getSnapshots(options);

            if (result.success) {
                timer(true, { count: result.snapshots.length });
                this._updateMetrics('get', timer(true));
            } else {
                timer(false, { error: result.error });
                this._updateMetrics('get', null, true);
            }

            return result;
        } catch (error) {
            timer(false, { error: error.message });
            this._updateMetrics('get', null, true);
            this.logger.error(`Failed to get snapshots: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a specific snapshot by ID
     * @param {string} id - Snapshot ID
     * @returns {Promise<{success: boolean, snapshot?: Snapshot, error?: string}>}
     */
    async getSnapshot(id) {
        if (!this.isInitialized) {
            return { success: false, error: 'Snapshot manager not initialized' };
        }

        const timer = this.logger.createTimer('get_snapshot');

        try {
            const result = await this.currentStrategy.getSnapshot(id);

            if (result.success) {
                timer(true);
                this._updateMetrics('get', timer(true));
            } else {
                timer(false, { error: result.error });
                this._updateMetrics('get', null, true);
            }

            return result;
        } catch (error) {
            timer(false, { error: error.message });
            this._updateMetrics('get', null, true);
            this.logger.error(`Failed to get snapshot ${id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Restore files from a snapshot
     * @param {string} id - Snapshot ID
     * @param {Object} options - Restoration options
     * @returns {Promise<{success: boolean, filesRestored?: Array, error?: string}>}
     */
    async restoreSnapshot(id, options = {}) {
        if (!this.isInitialized) {
            return { success: false, error: 'Snapshot manager not initialized' };
        }

        const operationId = this._generateOperationId();
        const timer = this.logger.createTimer('restore_snapshot');

        try {
            // Acquire operation lock
            await this._acquireOperationLock('restore', operationId);

            this.logger.info(`Restoring snapshot: ${id}`);

            const result = await this.currentStrategy.restoreSnapshot(id, options);

            if (result.success) {
                this._updateMetrics('restore', timer(true));

                this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_RESTORED, {
                    snapshotId: id,
                    filesRestored: result.filesRestored,
                    strategy: this.currentStrategy.getMode(),
                    operationId,
                });

                this.logger.info(`Snapshot restored successfully: ${id}`);
            } else {
                timer(false, { error: result.error });
                this._updateMetrics('restore', null, true);
            }

            return result;
        } catch (error) {
            timer(false, { error: error.message });
            this._updateMetrics('restore', null, true);
            this.logger.error(`Failed to restore snapshot ${id}: ${error.message}`);
            return { success: false, error: error.message };
        } finally {
            this._releaseOperationLock('restore', operationId);
        }
    }

    /**
     * Delete a snapshot
     * @param {string} id - Snapshot ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async deleteSnapshot(id) {
        if (!this.isInitialized) {
            return { success: false, error: 'Snapshot manager not initialized' };
        }

        const operationId = this._generateOperationId();
        const timer = this.logger.createTimer('delete_snapshot');

        try {
            // Acquire operation lock
            await this._acquireOperationLock('delete', operationId);

            this.logger.info(`Deleting snapshot: ${id}`);

            const result = await this.currentStrategy.deleteSnapshot(id);

            if (result.success) {
                this._updateMetrics('delete', timer(true));

                this.eventEmitter.emit(SnapshotEvents.SNAPSHOT_DELETED, {
                    snapshotId: id,
                    strategy: this.currentStrategy.getMode(),
                    operationId,
                });

                this.logger.info(`Snapshot deleted successfully: ${id}`);
            } else {
                timer(false, { error: result.error });
                this._updateMetrics('delete', null, true);
            }

            return result;
        } catch (error) {
            timer(false, { error: error.message });
            this._updateMetrics('delete', null, true);
            this.logger.error(`Failed to delete snapshot ${id}: ${error.message}`);
            return { success: false, error: error.message };
        } finally {
            this._releaseOperationLock('delete', operationId);
        }
    }

    /**
     * Clear all snapshots
     * @param {Object} options - Clear options
     * @returns {Promise<{success: boolean, cleared?: number, error?: string}>}
     */
    async clearSnapshots(options = {}) {
        if (!this.isInitialized) {
            return { success: false, error: 'Snapshot manager not initialized' };
        }

        const operationId = this._generateOperationId();
        const timer = this.logger.createTimer('clear_snapshots');

        try {
            // Acquire operation lock
            await this._acquireOperationLock('clear', operationId);

            this.logger.info('Clearing all snapshots');

            const result = await this.currentStrategy.clearSnapshots(options);

            if (result.success) {
                this._updateMetrics('clear', timer(true));

                this.eventEmitter.emit(SnapshotEvents.SNAPSHOTS_CLEARED, {
                    cleared: result.cleared,
                    strategy: this.currentStrategy.getMode(),
                    operationId,
                });

                this.logger.info(`Cleared ${result.cleared} snapshots`);
            } else {
                timer(false, { error: result.error });
                this._updateMetrics('clear', null, true);
            }

            return result;
        } catch (error) {
            timer(false, { error: error.message });
            this._updateMetrics('clear', null, true);
            this.logger.error(`Failed to clear snapshots: ${error.message}`);
            return { success: false, error: error.message };
        } finally {
            this._releaseOperationLock('clear', operationId);
        }
    }

    /**
     * Get the current status of the snapshot system
     * @returns {Promise<{success: boolean, status?: Object, error?: string}>}
     */
    async getStatus() {
        try {
            if (!this.isInitialized) {
                return {
                    success: true,
                    status: {
                        initialized: false,
                        strategy: null,
                        health: this.systemHealth,
                        metrics: this.metrics,
                    },
                };
            }

            const strategyStatus = await this.currentStrategy.getStatus();

            return {
                success: true,
                status: {
                    initialized: this.isInitialized,
                    strategy: this.currentStrategy.getMode(),
                    health: this.systemHealth,
                    metrics: this.metrics,
                    strategyDetails: strategyStatus,
                    activeOperations: this.activeOperations.size,
                    queuedOperations: this.operationQueue.length,
                },
            };
        } catch (error) {
            this.logger.error(`Failed to get status: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Switch to a different snapshot strategy
     * @param {string} mode - Strategy mode ('git' | 'file' | 'auto')
     * @param {Object} options - Switch options
     * @returns {Promise<{success: boolean, previousMode?: string, newMode?: string, error?: string}>}
     */
    async switchStrategy(mode, options = {}) {
        if (!this.isInitialized) {
            return { success: false, error: 'Snapshot manager not initialized' };
        }

        const timer = this.logger.createTimer('switch_strategy');
        const previousMode = this.currentStrategy.getMode();

        try {
            this.logger.info(`Switching strategy from ${previousMode} to ${mode}`);

            const result = await this.strategyFactory.switchToStrategy(
                mode,
                options.reason || 'manual'
            );

            if (result.success) {
                this.currentStrategy = this.strategyFactory.getCurrentStrategy();
                timer(true, { from: previousMode, to: mode });

                this.eventEmitter.emit(SnapshotEvents.STRATEGY_SWITCHED, {
                    previousMode,
                    newMode: mode,
                    reason: options.reason || 'manual',
                });

                this.logger.info(`Strategy switched successfully: ${previousMode} → ${mode}`);
                return { success: true, previousMode, newMode: result.newStrategy };
            } else {
                timer(false, { error: result.error });
                return { success: false, error: result.error };
            }
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to switch strategy: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate the integrity of a snapshot
     * @param {string} id - Snapshot ID
     * @returns {Promise<{success: boolean, valid?: boolean, issues?: Array, error?: string}>}
     */
    async validateSnapshot(id) {
        if (!this.isInitialized) {
            return { success: false, error: 'Snapshot manager not initialized' };
        }

        const timer = this.logger.createTimer('validate_snapshot');

        try {
            // Get the snapshot
            const snapshotResult = await this.getSnapshot(id);
            if (!snapshotResult.success) {
                return { success: false, error: snapshotResult.error };
            }

            // Validate using integrity validator
            const validationResult = await this.integrityValidator.validateSnapshot(
                snapshotResult.snapshot
            );

            timer(validationResult.valid);

            return {
                success: true,
                valid: validationResult.valid,
                issues: validationResult.issues || [],
            };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to validate snapshot ${id}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get performance metrics and statistics
     * @returns {Object} Performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            systemHealth: this.systemHealth,
            activeOperations: this.activeOperations.size,
            queuedOperations: this.operationQueue.length,
            strategy: this.currentStrategy ? this.currentStrategy.getMode() : null,
        };
    }

    /**
     * Cleanup resources and shutdown the manager
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async shutdown() {
        const timer = this.logger.createTimer('shutdown_manager');

        try {
            this.logger.info('Shutting down snapshot manager...');

            // Wait for active operations to complete
            if (this.activeOperations.size > 0) {
                this.logger.info(
                    `Waiting for ${this.activeOperations.size} active operations to complete...`
                );
                await Promise.all(Array.from(this.activeOperations.values()));
            }

            // Shutdown strategy
            if (this.currentStrategy) {
                await this.currentStrategy.shutdown();
            }

            // Shutdown performance optimizer if it has a shutdown method
            if (
                this.performanceOptimizer &&
                typeof this.performanceOptimizer.shutdown === 'function'
            ) {
                await this.performanceOptimizer.shutdown();
            }

            // Clear state
            this.isInitialized = false;
            this.currentStrategy = null;
            this.operationQueue = [];
            this.activeOperations.clear();
            this.operationLock.clear();

            timer(true);

            this.eventEmitter.emit(SnapshotEvents.MANAGER_SHUTDOWN, {
                reason: 'manual',
            });

            this.logger.info('Snapshot manager shutdown complete');
            return { success: true };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to shutdown snapshot manager: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // ===== Private Helper Methods =====

    /**
     * Set up event listeners for snapshot events
     * @private
     */
    _setupEventListeners() {
        // Listen for strategy switch events
        this.eventEmitter.on(SnapshotEvents.STRATEGY_SWITCHED, data => {
            this.logger.info(`Strategy switched: ${data.previousMode} → ${data.newMode}`);
            this._performHealthCheck();
        });

        // Listen for snapshot creation events
        this.eventEmitter.on(SnapshotEvents.SNAPSHOT_CREATED, data => {
            this.metrics.totalSnapshots++;
        });

        // Listen for error events
        this.eventEmitter.on(SnapshotEvents.SYSTEM_ERROR, data => {
            this.logger.error(`Snapshot error: ${data.error || 'Unknown error'}`);
            this.systemHealth.issues.push({
                timestamp: new Date(),
                type: data.type || 'unknown',
                message: data.error || 'Unknown error',
            });
        });
    }

    /**
     * Generate a unique operation ID
     * @private
     * @returns {string} Unique operation ID
     */
    _generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    /**
     * Acquire an operation lock (simplified)
     * @private
     * @param {string} type - Operation type
     * @param {string} id - Operation ID
     * @returns {Promise<void>}
     */
    async _acquireOperationLock(type, id) {
        // Simplified: just track the operation without complex queuing
        this.activeOperations.set(id, Promise.resolve());
        this.logger.debug(`Acquired lock for operation ${id} (${type})`);
    }

    /**
     * Release an operation lock (simplified)
     * @private
     * @param {string} type - Operation type
     * @param {string} id - Operation ID
     */
    _releaseOperationLock(type, id) {
        // Simplified: just remove from active operations
        this.activeOperations.delete(id);
        this.logger.debug(`Released lock for operation ${id} (${type})`);
    }

    /**
     * Validate snapshot inputs
     * @private
     * @param {string} instruction - Snapshot instruction
     * @param {Map<string, string>|Array<string>|null} files - Files to include
     * @param {Object} options - Additional options
     * @returns {{valid: boolean, error?: string}}
     */
    _validateSnapshotInputs(instruction, files, options) {
        // Validate instruction
        if (!instruction || typeof instruction !== 'string' || instruction.trim() === '') {
            return { valid: false, error: 'Snapshot instruction is required' };
        }

        // Validate files if provided
        if (files !== null) {
            if (files instanceof Map) {
                // Valid Map format
            } else if (Array.isArray(files)) {
                // Valid Array format
            } else {
                return { valid: false, error: 'Files must be a Map, Array, or null' };
            }
        }

        return { valid: true };
    }

    /**
     * Update performance metrics
     * @private
     * @param {string} operation - Operation type
     * @param {number|null} duration - Operation duration in ms
     * @param {boolean} isError - Whether operation resulted in error
     */
    _updateMetrics(operation, duration, isError = false) {
        this.metrics.totalOperations++;

        if (isError) {
            this.metrics.errorRate =
                (this.metrics.errorRate * (this.metrics.totalOperations - 1) + 1) /
                this.metrics.totalOperations;
        } else {
            this.metrics.errorRate =
                (this.metrics.errorRate * (this.metrics.totalOperations - 1)) /
                this.metrics.totalOperations;
        }

        if (duration) {
            this.metrics.lastOperationTime = duration;
            this.metrics.averageOperationTime =
                (this.metrics.averageOperationTime * (this.metrics.totalOperations - 1) +
                    duration) /
                this.metrics.totalOperations;
        }
    }

    /**
     * Perform a health check on the snapshot system
     * @private
     * @returns {Promise<void>}
     */
    async _performHealthCheck() {
        try {
            this.logger.debug('Performing snapshot system health check...');

            const strategyStatus = this.currentStrategy
                ? await this.currentStrategy.getStatus()
                : { success: false };
            const changeDetectorStatus =
                this.changeDetector && typeof this.changeDetector.getStatus === 'function'
                    ? await this.changeDetector.getStatus()
                    : { initialized: true };

            // Check strategy health
            const strategyHealthy = strategyStatus.success && !strategyStatus.error;

            // Check change detector health
            const changeDetectorHealthy = changeDetectorStatus && changeDetectorStatus.initialized;

            // Update system health
            this.systemHealth = {
                status: strategyHealthy && changeDetectorHealthy ? 'healthy' : 'degraded',
                lastCheck: new Date(),
                issues: this.systemHealth.issues.slice(-10), // Keep last 10 issues
                components: {
                    strategy: {
                        healthy: strategyHealthy,
                        mode: this.currentStrategy.getMode(),
                    },
                    changeDetector: {
                        healthy: changeDetectorHealthy,
                    },
                },
            };

            this.logger.debug(`Health check complete: ${this.systemHealth.status}`);
        } catch (error) {
            this.logger.error(`Health check failed: ${error.message}`);
            this.systemHealth = {
                status: 'error',
                lastCheck: new Date(),
                issues: [
                    ...this.systemHealth.issues.slice(-9),
                    {
                        timestamp: new Date(),
                        type: 'health_check',
                        message: error.message,
                    },
                ],
            };
        }
    }
}
