/**
 * Tool Manager Integration for Phase 2 - Automatic Snapshot Creation
 * Non-intrusive integration hooks with the ToolManager execution flow
 */

import { getLogger } from '../managers/logger.js';

export class ToolManagerIntegration {
    constructor(snapshotTrigger, toolMonitor, fileChangeDetector, config = {}) {
        this.snapshotTrigger = snapshotTrigger;
        this.toolMonitor = toolMonitor;
        this.fileChangeDetector = fileChangeDetector;
        this.config = {
            enabled: true,
            trackFileChanges: true,
            cleanupEmptySnapshots: true,
            logToolExecution: true,
            ...config,
        };

        this.logger = getLogger();

        // Track active tool executions
        this.activeExecutions = new Map();

        // Track file states for change detection
        this.preExecutionStates = new Map();

        this.logger.debug('ToolManagerIntegration initialized', { config: this.config });
    }

    /**
     * Integrate with ToolManager
     * @param {Object} toolManager - ToolManager instance
     */
    integrateWithToolManager(toolManager) {
        if (!toolManager) {
            this.logger.warn('No ToolManager provided for integration');
            return;
        }

        this.logger.debug('Integrating with ToolManager');

        // Store original executeToolCall method
        const originalExecuteToolCall = toolManager.executeToolCall.bind(toolManager);

        // Replace with our enhanced version
        toolManager.executeToolCall = async (toolCall, consoleInterface, snapshotManager) => {
            return await this.enhancedExecuteToolCall(
                originalExecuteToolCall,
                toolCall,
                consoleInterface,
                snapshotManager
            );
        };

        this.logger.debug('ToolManager integration complete');
    }

    /**
     * Enhanced executeToolCall with snapshot integration
     * @private
     */
    async enhancedExecuteToolCall(
        originalExecuteToolCall,
        toolCall,
        consoleInterface,
        snapshotManager
    ) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const executionId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            if (!this.config.enabled) {
                // If integration is disabled, just call original method
                return await originalExecuteToolCall(toolCall, consoleInterface, snapshotManager);
            }

            // Before tool execution hook
            await this.beforeToolExecution(toolName, toolArgs, { executionId });

            // Execute the original tool
            const result = await originalExecuteToolCall(
                toolCall,
                consoleInterface,
                snapshotManager
            );

            // After tool execution hook
            await this.afterToolExecution(toolName, result, { executionId });

            return result;
        } catch (error) {
            // Error handling hook
            await this.onToolError(toolName, error, { executionId });
            throw error;
        }
    }

    /**
     * Setup integration hooks for ToolManager
     * @param {Object} toolManager - ToolManager instance
     */
    setupToolExecutionHooks(toolManager) {
        // This method is kept for compatibility but the main integration
        // is now done through enhancedExecuteToolCall
        this.integrateWithToolManager(toolManager);
    }

    /**
     * Setup application startup hooks
     * @param {Object} app - Application instance
     */
    setupApplicationStartupHooks(app) {
        if (!app) {
            this.logger.warn('No application instance provided for startup hooks');
            return;
        }

        this.logger.debug('Setting up application startup hooks');

        // Hook into application start if the method exists
        if (typeof app.onApplicationStart === 'function') {
            const originalOnStart = app.onApplicationStart.bind(app);
            app.onApplicationStart = async context => {
                await this.onApplicationStart(context);
                return await originalOnStart(context);
            };
        }
    }

    /**
     * Before tool execution hook
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     * @returns {Promise<void>}
     */
    async beforeToolExecution(toolName, args, context) {
        try {
            const { executionId } = context;

            this.logger.debug(`Before tool execution: ${toolName}`, { executionId });

            // Track active execution
            this.activeExecutions.set(executionId, {
                toolName,
                args,
                startTime: Date.now(),
                context,
            });

            // Capture pre-execution file state if configured
            if (this.config.trackFileChanges && this.toolMonitor.shouldCreateSnapshot(toolName)) {
                try {
                    const basePath = process.cwd();
                    const preState = await this.fileChangeDetector.captureFileStates(basePath);
                    this.preExecutionStates.set(executionId, preState);

                    this.logger.debug(`Captured pre-execution file state for ${toolName}`, {
                        executionId,
                        fileCount: Object.keys(preState.files).length,
                    });
                } catch (stateError) {
                    this.logger.warn(
                        `Failed to capture pre-execution state for ${toolName}`,
                        stateError
                    );
                }
            }

            // Trigger snapshot creation
            const snapshot = await this.snapshotTrigger.onToolExecution(toolName, args, {
                executionId,
                ...context,
            });

            if (snapshot) {
                // Associate snapshot with execution
                const execution = this.activeExecutions.get(executionId);
                if (execution) {
                    execution.snapshotId = snapshot.id;
                    execution.snapshotCreated = true;
                }
            }
        } catch (error) {
            this.logger.error(`Error in beforeToolExecution for ${toolName}`, error);
            // Don't throw - tool execution should continue even if snapshot fails
        }
    }

    /**
     * After tool execution hook
     * @param {string} toolName - Name of the tool
     * @param {Object} results - Tool execution results
     * @param {Object} context - Execution context
     * @returns {Promise<void>}
     */
    async afterToolExecution(toolName, results, context) {
        try {
            const { executionId } = context;

            this.logger.debug(`After tool execution: ${toolName}`, {
                executionId,
                success: results?.success,
            });

            const execution = this.activeExecutions.get(executionId);
            if (!execution) {
                this.logger.warn(`No execution record found for ${executionId}`);
                return;
            }

            // Update execution record
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;
            execution.results = results;

            // Check for file changes if we have pre-execution state
            if (this.config.trackFileChanges && this.preExecutionStates.has(executionId)) {
                await this.checkFileChanges(toolName, executionId, execution);
            }

            // Notify snapshot trigger of completion
            await this.snapshotTrigger.onExecutionComplete(toolName, results, {
                executionId,
                execution,
                ...context,
            });

            // Log execution if configured
            if (this.config.logToolExecution) {
                this.logger.debug(`Tool execution completed: ${toolName}`, {
                    executionId,
                    duration: execution.duration,
                    success: results?.success,
                    snapshotCreated: execution.snapshotCreated || false,
                });
            }
        } catch (error) {
            this.logger.error(`Error in afterToolExecution for ${toolName}`, error);
        } finally {
            // Clean up execution tracking
            this.activeExecutions.delete(context.executionId);
            this.preExecutionStates.delete(context.executionId);
        }
    }

    /**
     * Check for file changes after tool execution
     * @private
     */
    async checkFileChanges(toolName, executionId, execution) {
        try {
            const preState = this.preExecutionStates.get(executionId);
            if (!preState) {
                return;
            }

            // Capture post-execution state
            const basePath = process.cwd();
            const postState = await this.fileChangeDetector.captureFileStates(basePath);

            // Compare states
            const changes = this.fileChangeDetector.compareFileStates(preState, postState);

            // Store changes in execution record
            execution.fileChanges = changes;

            // Validate changes against tool expectations
            const validation = this.fileChangeDetector.validateActualChanges(
                toolName,
                execution.args,
                changes
            );
            execution.changeValidation = validation;

            // Warn about unexpected changes
            const expectedModifications = this.toolMonitor.modifiesFiles(toolName);
            this.fileChangeDetector.warnAboutUnexpectedChanges(
                toolName,
                expectedModifications,
                changes
            );

            // Clean up empty snapshots if configured
            if (
                this.config.cleanupEmptySnapshots &&
                execution.snapshotCreated &&
                !changes.hasChanges
            ) {
                await this.cleanupEmptySnapshot(execution.snapshotId, toolName);
            }

            this.logger.debug(`File change analysis completed for ${toolName}`, {
                executionId,
                hasChanges: changes.hasChanges,
                changeCount: changes.changeCount,
            });
        } catch (error) {
            this.logger.warn(`Failed to check file changes for ${toolName}`, error);
        }
    }

    /**
     * Clean up empty snapshot
     * @private
     */
    async cleanupEmptySnapshot(snapshotId, toolName) {
        if (!snapshotId) {
            return;
        }

        try {
            // Note: This would require adding a cleanup method to SnapshotManager
            // For now, we'll just log the intention
            this.logger.debug(`Empty snapshot cleanup needed for ${toolName}`, { snapshotId });

            // TODO: Implement snapshot cleanup when SnapshotManager supports it
            // await this.snapshotManager.cleanupEmptySnapshot(snapshotId);
        } catch (error) {
            this.logger.warn(`Failed to cleanup empty snapshot ${snapshotId}`, error);
        }
    }

    /**
     * Tool error hook
     * @param {string} toolName - Name of the tool
     * @param {Error} error - Error that occurred
     * @param {Object} context - Execution context
     * @returns {Promise<void>}
     */
    async onToolError(toolName, error, context) {
        try {
            const { executionId } = context;

            this.logger.debug(`Tool execution error: ${toolName}`, {
                executionId,
                error: error.message,
            });

            const execution = this.activeExecutions.get(executionId);
            if (execution) {
                execution.error = error;
                execution.endTime = Date.now();
                execution.duration = execution.endTime - execution.startTime;
            }

            // Clean up if needed
            this.activeExecutions.delete(executionId);
            this.preExecutionStates.delete(executionId);
        } catch (cleanupError) {
            this.logger.error(`Error in tool error handler for ${toolName}`, cleanupError);
        }
    }

    /**
     * Application start hook
     * @param {Object} context - Application context
     * @returns {Promise<void>}
     */
    async onApplicationStart(context) {
        try {
            this.logger.debug('Application start hook triggered');

            // Reset integration state
            this.activeExecutions.clear();
            this.preExecutionStates.clear();

            // Notify snapshot trigger
            await this.snapshotTrigger.onApplicationStart(context);
        } catch (error) {
            this.logger.error('Error in application start hook', error);
        }
    }

    /**
     * Track tool execution state
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @param {Object} context - Execution context
     */
    trackToolExecutionState(toolName, args, context) {
        // This is handled in the execution hooks
        this.logger.debug(`Tracking execution state for ${toolName}`, context);
    }

    /**
     * Manage snapshot session
     * @param {string} sessionId - Session ID
     */
    manageSnapshotSession(sessionId) {
        // Session management is delegated to SnapshotTrigger
        this.logger.debug(`Managing snapshot session: ${sessionId}`);
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.debug('ToolManagerIntegration configuration updated', { config: this.config });
    }

    /**
     * Get integration statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            enabled: this.config.enabled,
            activeExecutions: this.activeExecutions.size,
            preExecutionStates: this.preExecutionStates.size,
            trackFileChanges: this.config.trackFileChanges,
            cleanupEmptySnapshots: this.config.cleanupEmptySnapshots,
            config: { ...this.config },
        };
    }

    /**
     * Clean up integration state
     */
    cleanup() {
        this.activeExecutions.clear();
        this.preExecutionStates.clear();
        this.logger.debug('ToolManagerIntegration cleanup completed');
    }
}

export default ToolManagerIntegration;
