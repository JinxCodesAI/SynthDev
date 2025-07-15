/**
 * Strategy Factory for Snapshot System
 * Handles automatic strategy selection and switching between Git and file-based operations
 */

import { GitSnapshotStrategy } from './GitSnapshotStrategy.js';
import { FileSnapshotStrategy } from './FileSnapshotStrategy.js';
import SnapshotConfig from '../SnapshotConfig.js';
import SnapshotEventEmitter from '../events/SnapshotEventEmitter.js';
import { SnapshotEvents } from '../events/SnapshotEvents.js';
import SnapshotLogger from '../utils/SnapshotLogger.js';

/**
 * Factory for creating and managing snapshot strategies
 */
export class StrategyFactory {
    constructor(config = null, eventEmitter = null) {
        this.config = config || new SnapshotConfig();
        this.eventEmitter = eventEmitter || new SnapshotEventEmitter();
        this.logger = new SnapshotLogger('StrategyFactory');

        // Strategy instances
        this.strategies = new Map();
        this.currentStrategy = null;
        this.preferredMode = this.config.getSnapshotConfig().mode; // 'auto', 'git', 'file'

        // Mode detection cache
        this.modeDetectionCache = {
            lastCheck: 0,
            cacheDuration: 30000, // 30 seconds
            result: null,
        };

        // Strategy switching state
        this.switchingInProgress = false;
        this.switchHistory = [];
        this.maxSwitchHistory = 10;
    }

    /**
     * Initialize the strategy factory
     * @returns {Promise<{success: boolean, strategy?: string, error?: string}>}
     */
    async initialize() {
        const timer = this.logger.createTimer('initialize');

        try {
            this.logger.info('Initializing strategy factory...');

            // Determine initial strategy
            const strategyResult = await this.selectStrategy();
            if (!strategyResult.success) {
                timer(false, { error: strategyResult.error });
                return { success: false, error: strategyResult.error };
            }

            // Initialize the selected strategy
            const initResult = await this.currentStrategy.initialize();
            if (!initResult.success) {
                // Try fallback to file strategy if Git fails
                if (strategyResult.strategy === 'git') {
                    this.logger.warn('Git strategy failed, falling back to file strategy');
                    const fallbackResult = await this.switchToStrategy(
                        'file',
                        'git_initialization_failed'
                    );
                    if (!fallbackResult.success) {
                        timer(false, { error: fallbackResult.error });
                        return { success: false, error: fallbackResult.error };
                    }
                } else {
                    timer(false, { error: initResult.error });
                    return { success: false, error: initResult.error };
                }
            }

            timer(true, { strategy: this.currentStrategy.getMode() });

            this.eventEmitter.emit(SnapshotEvents.STRATEGY_FACTORY_INITIALIZED, {
                strategy: this.currentStrategy.getMode(),
                preferredMode: this.preferredMode,
            });

            this.logger.info(
                `Strategy factory initialized with ${this.currentStrategy.getMode()} strategy`
            );
            return { success: true, strategy: this.currentStrategy.getMode() };
        } catch (error) {
            timer(false, { error: error.message });
            this.logger.error(`Failed to initialize strategy factory: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get the current strategy instance
     * @returns {SnapshotStrategy} Current strategy
     */
    getCurrentStrategy() {
        return this.currentStrategy;
    }

    /**
     * Get current strategy mode
     * @returns {string} Strategy mode ('git' or 'file')
     */
    getCurrentMode() {
        return this.currentStrategy ? this.currentStrategy.getMode() : null;
    }

    /**
     * Select appropriate strategy based on configuration and environment
     * @returns {Promise<{success: boolean, strategy?: string, error?: string}>}
     */
    async selectStrategy() {
        try {
            const mode = this.preferredMode;

            if (mode === 'git') {
                // Force Git mode
                const strategy = await this.createStrategy('git');
                if (await this.isStrategyAvailable(strategy)) {
                    this.currentStrategy = strategy;
                    return { success: true, strategy: 'git' };
                } else {
                    return { success: false, error: 'Git strategy not available' };
                }
            } else if (mode === 'file') {
                // Force file mode
                const strategy = await this.createStrategy('file');
                this.currentStrategy = strategy;
                return { success: true, strategy: 'file' };
            } else {
                // Auto mode - detect best strategy
                return await this.autoSelectStrategy();
            }
        } catch (error) {
            this.logger.error(`Failed to select strategy: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Automatically select the best available strategy
     * @returns {Promise<{success: boolean, strategy?: string, error?: string}>}
     */
    async autoSelectStrategy() {
        try {
            // Check cache first
            const now = Date.now();
            if (
                this.modeDetectionCache.result &&
                now - this.modeDetectionCache.lastCheck < this.modeDetectionCache.cacheDuration
            ) {
                const cachedMode = this.modeDetectionCache.result;
                const strategy = await this.createStrategy(cachedMode);
                this.currentStrategy = strategy;
                return { success: true, strategy: cachedMode };
            }

            // Try Git strategy first
            const gitStrategy = await this.createStrategy('git');
            if (await this.isStrategyAvailable(gitStrategy)) {
                this.currentStrategy = gitStrategy;
                this.updateModeDetectionCache('git');
                return { success: true, strategy: 'git' };
            }

            // Fallback to file strategy
            const fileStrategy = await this.createStrategy('file');
            this.currentStrategy = fileStrategy;
            this.updateModeDetectionCache('file');
            return { success: true, strategy: 'file' };
        } catch (error) {
            this.logger.error(`Failed to auto-select strategy: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Switch to a different strategy
     * @param {string} mode - Target strategy mode ('git' or 'file')
     * @param {string} reason - Reason for switching
     * @returns {Promise<{success: boolean, previousStrategy?: string, newStrategy?: string, error?: string}>}
     */
    async switchToStrategy(mode, reason = 'manual') {
        if (this.switchingInProgress) {
            return { success: false, error: 'Strategy switch already in progress' };
        }

        const timer = this.logger.createTimer('switch_strategy');
        this.switchingInProgress = true;

        try {
            const previousMode = this.currentStrategy ? this.currentStrategy.getMode() : null;

            if (previousMode === mode) {
                this.switchingInProgress = false;
                return { success: true, previousStrategy: previousMode, newStrategy: mode };
            }

            this.logger.info(
                `Switching strategy from ${previousMode} to ${mode} (reason: ${reason})`
            );

            // Create new strategy
            const newStrategy = await this.createStrategy(mode);

            // Check if new strategy is available
            if (!(await this.isStrategyAvailable(newStrategy))) {
                this.switchingInProgress = false;
                return { success: false, error: `${mode} strategy is not available` };
            }

            // Initialize new strategy
            const initResult = await newStrategy.initialize();
            if (!initResult.success) {
                this.switchingInProgress = false;
                return { success: false, error: initResult.error };
            }

            // Switch to new strategy
            this.currentStrategy = newStrategy;
            this.updateModeDetectionCache(mode);

            // Record switch in history
            this.recordStrategySwitch(previousMode, mode, reason);

            timer(true, { previousStrategy: previousMode, newStrategy: mode, reason });

            this.eventEmitter.emit(SnapshotEvents.STRATEGY_SWITCHED, {
                previousStrategy: previousMode,
                newStrategy: mode,
                reason,
                timestamp: new Date().toISOString(),
            });

            this.switchingInProgress = false;
            return { success: true, previousStrategy: previousMode, newStrategy: mode };
        } catch (error) {
            this.switchingInProgress = false;
            timer(false, { error: error.message });
            this.logger.error(`Failed to switch strategy: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle strategy failure and attempt graceful degradation
     * @param {Error} error - The error that caused the failure
     * @returns {Promise<{success: boolean, newStrategy?: string, error?: string}>}
     */
    async handleStrategyFailure(error) {
        const currentMode = this.getCurrentMode();

        this.logger.warn(`Strategy failure in ${currentMode} mode: ${error.message}`);

        // If Git strategy fails, try to switch to file strategy
        if (currentMode === 'git') {
            const switchResult = await this.switchToStrategy('file', 'git_operation_failed');
            if (switchResult.success) {
                this.logger.info('Successfully degraded to file strategy after Git failure');
                return { success: true, newStrategy: 'file' };
            }
        }

        // If file strategy fails or switch fails, we're in trouble
        return { success: false, error: 'All strategies have failed' };
    }

    /**
     * Get factory status and statistics
     * @returns {Object} Factory status
     */
    getStatus() {
        return {
            currentStrategy: this.getCurrentMode(),
            preferredMode: this.preferredMode,
            switchingInProgress: this.switchingInProgress,
            availableStrategies: ['git', 'file'],
            switchHistory: this.switchHistory.slice(-5), // Last 5 switches
            modeDetectionCache: {
                lastCheck: new Date(this.modeDetectionCache.lastCheck).toISOString(),
                result: this.modeDetectionCache.result,
                cacheValid:
                    Date.now() - this.modeDetectionCache.lastCheck <
                    this.modeDetectionCache.cacheDuration,
            },
            strategyStatus: this.currentStrategy ? this.currentStrategy.getStatus() : null,
        };
    }

    /**
     * Force refresh of mode detection cache
     * @returns {Promise<{success: boolean, detectedMode?: string, error?: string}>}
     */
    async refreshModeDetection() {
        try {
            this.modeDetectionCache.lastCheck = 0; // Force cache miss
            const result = await this.autoSelectStrategy();
            return { success: true, detectedMode: result.strategy };
        } catch (error) {
            this.logger.error(`Failed to refresh mode detection: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Create strategy instance
     * @param {string} mode - Strategy mode ('git' or 'file')
     * @returns {Promise<SnapshotStrategy>} Strategy instance
     */
    async createStrategy(mode) {
        if (this.strategies.has(mode)) {
            return this.strategies.get(mode);
        }

        let strategy;
        if (mode === 'git') {
            strategy = new GitSnapshotStrategy(this.config, this.eventEmitter);
        } else if (mode === 'file') {
            strategy = new FileSnapshotStrategy(this.config, this.eventEmitter);
        } else {
            throw new Error(`Unknown strategy mode: ${mode}`);
        }

        this.strategies.set(mode, strategy);
        return strategy;
    }

    /**
     * Check if strategy is available
     * @param {SnapshotStrategy} strategy - Strategy to check
     * @returns {Promise<boolean>} True if strategy is available
     */
    async isStrategyAvailable(strategy) {
        try {
            const availability = await strategy.isAvailable();
            return availability.available;
        } catch (error) {
            this.logger.warn(`Strategy availability check failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Update mode detection cache
     * @param {string} mode - Detected mode
     */
    updateModeDetectionCache(mode) {
        this.modeDetectionCache.lastCheck = Date.now();
        this.modeDetectionCache.result = mode;
    }

    /**
     * Record strategy switch in history
     * @param {string} from - Previous strategy
     * @param {string} to - New strategy
     * @param {string} reason - Reason for switch
     */
    recordStrategySwitch(from, to, reason) {
        const switchRecord = {
            from,
            to,
            reason,
            timestamp: new Date().toISOString(),
        };

        this.switchHistory.push(switchRecord);

        // Keep only recent switches
        if (this.switchHistory.length > this.maxSwitchHistory) {
            this.switchHistory.shift();
        }
    }

    /**
     * Validate strategy mode
     * @param {string} mode - Mode to validate
     * @returns {boolean} True if mode is valid
     */
    isValidMode(mode) {
        return ['git', 'file'].includes(mode);
    }
}

/**
 * Singleton instance for global access
 */
let factoryInstance = null;

/**
 * Get or create strategy factory instance
 * @param {SnapshotConfig} config - Configuration instance
 * @param {SnapshotEventEmitter} eventEmitter - Event emitter instance
 * @returns {StrategyFactory} Factory instance
 */
export function getStrategyFactory(config = null, eventEmitter = null) {
    if (!factoryInstance) {
        factoryInstance = new StrategyFactory(config, eventEmitter);
    }
    return factoryInstance;
}

/**
 * Reset factory instance (for testing)
 */
export function resetStrategyFactory() {
    factoryInstance = null;
}
