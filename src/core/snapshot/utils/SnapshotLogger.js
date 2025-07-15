/**
 * Structured logging system for the snapshot system
 * Extends the base logger with snapshot-specific functionality
 */

import { getLogger } from '../../managers/logger.js';

/**
 * Snapshot-specific logger with structured logging capabilities
 */
class SnapshotLogger {
    constructor(component = 'snapshot') {
        this.baseLogger = getLogger();
        this.component = component;
    }

    /**
     * Log a snapshot operation with structured metadata
     * @param {string} operation - Operation name (create, restore, delete, etc.)
     * @param {Object} metadata - Operation metadata
     */
    logSnapshotOperation(operation, metadata) {
        const logData = {
            component: this.component,
            operation: operation,
            timestamp: new Date().toISOString(),
            mode: metadata.mode,
            duration: metadata.duration,
            filesAffected: metadata.filesAffected,
            success: metadata.success,
            error: metadata.error,
            userId: metadata.userId,
            sessionId: metadata.sessionId,
            snapshotId: metadata.snapshotId,
        };

        if (metadata.success) {
            this.baseLogger.info(`Snapshot ${operation} completed successfully`, logData);
        } else {
            this.baseLogger.error(`Snapshot ${operation} failed: ${metadata.error}`, logData);
        }
    }

    /**
     * Log performance metrics
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {Object} context - Additional context
     */
    logPerformanceMetric(metric, value, context = {}) {
        const logData = {
            type: 'performance',
            component: this.component,
            metric: metric,
            value: value,
            context: context,
            timestamp: new Date().toISOString(),
        };

        this.baseLogger.debug(`Performance metric: ${metric} = ${value}`, logData);
    }

    /**
     * Log Git operations
     * @param {string} operation - Git operation (branch, commit, merge, etc.)
     * @param {Object} details - Operation details
     */
    logGitOperation(operation, details) {
        const logData = {
            component: `${this.component}:git`,
            operation: operation,
            timestamp: new Date().toISOString(),
            ...details,
        };

        if (details.success) {
            this.baseLogger.info(`Git ${operation} completed`, logData);
        } else {
            this.baseLogger.error(`Git ${operation} failed: ${details.error}`, logData);
        }
    }

    /**
     * Log file operations
     * @param {string} operation - File operation (backup, restore, delete, etc.)
     * @param {string} filePath - File path
     * @param {Object} details - Operation details
     */
    logFileOperation(operation, filePath, details = {}) {
        const logData = {
            component: `${this.component}:file`,
            operation: operation,
            filePath: filePath,
            timestamp: new Date().toISOString(),
            ...details,
        };

        this.baseLogger.debug(`File ${operation}: ${filePath}`, logData);
    }

    /**
     * Log strategy operations
     * @param {string} operation - Strategy operation
     * @param {string} strategyType - Strategy type (git, file)
     * @param {Object} details - Operation details
     */
    logStrategyOperation(operation, strategyType, details = {}) {
        const logData = {
            component: `${this.component}:strategy`,
            operation: operation,
            strategyType: strategyType,
            timestamp: new Date().toISOString(),
            ...details,
        };

        this.baseLogger.info(`Strategy ${operation}: ${strategyType}`, logData);
    }

    /**
     * Log user interactions
     * @param {string} action - User action
     * @param {Object} context - Interaction context
     */
    logUserInteraction(action, context = {}) {
        const logData = {
            component: `${this.component}:ui`,
            action: action,
            timestamp: new Date().toISOString(),
            ...context,
        };

        this.baseLogger.info(`User action: ${action}`, logData);
    }

    /**
     * Log security events
     * @param {string} event - Security event type
     * @param {Object} details - Event details
     */
    logSecurityEvent(event, details = {}) {
        const logData = {
            component: `${this.component}:security`,
            event: event,
            timestamp: new Date().toISOString(),
            severity: details.severity || 'medium',
            ...details,
        };

        if (details.severity === 'high') {
            this.baseLogger.error(`Security event: ${event}`, logData);
        } else {
            this.baseLogger.warn(`Security event: ${event}`, logData);
        }
    }

    /**
     * Log system health events
     * @param {string} component - Component name
     * @param {Object} healthData - Health check data
     */
    logHealthCheck(component, healthData) {
        const logData = {
            component: `${this.component}:health`,
            healthComponent: component,
            timestamp: new Date().toISOString(),
            healthy: healthData.healthy,
            details: healthData.details,
        };

        if (healthData.healthy) {
            this.baseLogger.debug(`Health check passed: ${component}`, logData);
        } else {
            this.baseLogger.warn(`Health check failed: ${component}`, logData);
        }
    }

    /**
     * Create a timer for measuring operation duration
     * @param {string} operation - Operation name
     * @returns {Function} Timer function to call when operation completes
     */
    createTimer(operation) {
        const startTime = Date.now();
        return (success = true, metadata = {}) => {
            const duration = Date.now() - startTime;
            this.logPerformanceMetric(`${operation}_duration`, duration, {
                success,
                ...metadata,
            });
            return duration;
        };
    }

    /**
     * Log with structured format for external monitoring systems
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} data - Structured data
     */
    logStructured(level, message, data = {}) {
        const structuredLog = {
            level: level,
            message: message,
            component: this.component,
            timestamp: new Date().toISOString(),
            ...data,
        };

        // Use appropriate base logger method
        switch (level.toLowerCase()) {
        case 'error':
            this.baseLogger.error(message, structuredLog);
            break;
        case 'warn':
            this.baseLogger.warn(message, structuredLog);
            break;
        case 'info':
            this.baseLogger.info(message, structuredLog);
            break;
        case 'debug':
            this.baseLogger.debug(message, structuredLog);
            break;
        default:
            this.baseLogger.info(message, structuredLog);
        }
    }

    // Convenience methods that delegate to base logger
    error(message, context = '') {
        this.baseLogger.error(message, context);
    }

    warn(message, context = '') {
        this.baseLogger.warn(message, context);
    }

    info(message) {
        this.baseLogger.info(message);
    }

    debug(message, data = null) {
        this.baseLogger.debug(message, data);
    }

    status(message) {
        this.baseLogger.status(message);
    }

    user(message, prefix = '📸 Snapshots:') {
        this.baseLogger.user(message, prefix);
    }
}

export default SnapshotLogger;
