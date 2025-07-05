/**
 * Centralized logging system with verbosity levels
 *
 * Verbosity Levels:
 * 0 - Only information directly affecting the user is visible
 * 1 - Short messages like "🔄 Enhancing prompt...", "🧠 Synth-Dev is thinking..."
 * 2 - Compressed arguments for tool execution (default)
 * 3 - Uncompressed arguments but no tool results
 * 4 - Both arguments and tool results
 * 5 - Every HTTP request and response
 */
class Logger {
    constructor(verbosityLevel = 2) {
        this.verbosityLevel = verbosityLevel;
        this.httpRequests = [];
    }

    /**
     * Set the verbosity level
     * @param {number} level - Verbosity level (0-5)
     */
    setVerbosityLevel(level) {
        this.raw(`Setting verbosity level to:${level}`);
        if (level >= 0 && level <= 5) {
            this.verbosityLevel = level;
        }
    }

    /**
     * Get current verbosity level
     * @returns {number} Current verbosity level
     */
    getVerbosityLevel() {
        return this.verbosityLevel;
    }

    /**
     * Level 0: Only information directly affecting the user
     * @param {string} message - Message to log
     * @param {string} prefix - Optional prefix
     */
    user(message, prefix = '🤖 Synth-Dev:') {
        if (this.verbosityLevel >= 0) {
            console.log(prefix, message);
        }
    }

    /**
     * Level 1: Short status messages
     * @param {string} message - Message to log
     */
    status(message) {
        if (this.verbosityLevel >= 1) {
            console.log(message);
        }
    }

    /**
     * Level 2: Tool execution with compressed arguments (default level)
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     */
    toolExecution(toolName, args) {
        if (this.verbosityLevel >= 2) {
            console.log(`🔧 Executing tool: ${toolName}`);
            const compressedArgs = this._compressArguments(args);
            console.log('📝 Arguments:', compressedArgs);
        }
    }

    /**
     * Level 3: Uncompressed arguments but no results
     * @param {string} toolName - Name of the tool
     * @param {Object} args - Tool arguments
     */
    toolExecutionDetailed(toolName, args) {
        if (this.verbosityLevel >= 3) {
            console.log(`🔧 Executing tool: ${toolName}`);
            console.log('📝 Arguments:', args);
        } else if (this.verbosityLevel === 2) {
            this.toolExecution(toolName, args);
        }
    }

    /**
     * Level 4: Both arguments and tool results
     * @param {any} result - Tool result
     */
    toolResult(result) {
        if (this.verbosityLevel >= 4) {
            console.log('✅ Tool result:', result);
            console.log();
        }
    }

    /**
     * Level 5: HTTP requests and responses
     * @param {string} method - HTTP method
     * @param {string} url - Request URL
     * @param {Object} requestData - Request data
     * @param {Object} responseData - Response data
     */
    httpRequest(method, url, requestData, responseData = null) {
        if (this.verbosityLevel >= 5) {
            const timestamp = new Date().toISOString();
            console.log(`\n🌐 HTTP ${method} Request [${timestamp}]`);
            console.log(`📍 URL: ${url}`);
            console.log('📤 Request:', JSON.stringify(requestData, null, 2));

            if (responseData) {
                console.log('📥 Response:', JSON.stringify(responseData, null, 2));
            }
            console.log('─'.repeat(80));
        }

        // Store for potential later use
        this.httpRequests.push({
            timestamp: new Date().toISOString(),
            method,
            url,
            request: requestData,
            response: responseData,
        });
    }

    /**
     * Error logging (always visible regardless of verbosity)
     * @param {string|Error} error - Error message or Error object
     * @param {string} context - Optional context
     */
    error(error, context = '') {
        const message = error instanceof Error ? error.message : error;
        const prefix = context ? `❌ ${context}:` : '❌ Error:';
        console.error(prefix, message);

        if (error instanceof Error && error.response?.data) {
            console.error('Response data:', error.response.data);
        }
    }

    /**
     * Warning logging (visible at level 1+)
     * @param {string} message - Warning message
     * @param {string} context - Optional context
     */
    warn(message, context = '') {
        if (this.verbosityLevel >= 1) {
            const prefix = context ? `⚠️ ${context}:` : '⚠️ Warning:';
            console.warn(prefix, message);
        }
    }

    /**
     * Debug logging (visible at level 3+)
     * @param {string} message - Debug message
     * @param {any} data - Optional data to log
     */
    debug(message, data = null) {
        if (this.verbosityLevel >= 3) {
            console.log(`🐛 Debug: ${message}`);
            if (data !== null) {
                console.log(data);
            }
        }
    }

    /**
     * Info logging (visible at level 2+)
     * @param {string} message - Info message
     */
    info(message) {
        if (this.verbosityLevel >= 2) {
            console.log(`ℹ️ ${message}`);
        }
    }

    /**
     * Raw console.log (always visible - use sparingly)
     * @param {...any} args - Arguments to log
     */
    raw(...args) {
        console.log(...args);
    }

    /**
     * Compress arguments for display at verbosity level 2
     * @private
     * @param {Object} args - Arguments to compress
     * @returns {Object} Compressed arguments
     */
    _compressArguments(args) {
        if (!args || typeof args !== 'object') {
            return args;
        }

        const compressed = {};
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string' && value.length > 50) {
                compressed[key] = `${value.substring(0, 47)}...`;
            } else if (Array.isArray(value) && value.length > 3) {
                compressed[key] = [...value.slice(0, 3), `... (${value.length - 3} more)`];
            } else if (typeof value === 'object' && value !== null) {
                const keys = Object.keys(value);
                if (keys.length > 3) {
                    const sample = {};
                    keys.slice(0, 3).forEach(k => (sample[k] = value[k]));
                    sample['...'] = `(${keys.length - 3} more properties)`;
                    compressed[key] = sample;
                } else {
                    compressed[key] = this._compressArguments(value);
                }
            } else {
                compressed[key] = value;
            }
        }
        return compressed;
    }

    /**
     * Get recent HTTP requests (for debugging)
     * @param {number} count - Number of recent requests to return
     * @returns {Array} Recent HTTP requests
     */
    getRecentHttpRequests(count = 10) {
        return this.httpRequests.slice(-count);
    }

    /**
     * Clear HTTP request history
     */
    clearHttpHistory() {
        this.httpRequests = [];
    }
}

// Create singleton instance
let loggerInstance = null;

/**
 * Get the logger instance
 * @param {number} verbosityLevel - Optional verbosity level to set
 * @returns {Logger} Logger instance
 */
export function getLogger(verbosityLevel = null) {
    if (!loggerInstance) {
        loggerInstance = new Logger(verbosityLevel !== null ? verbosityLevel : 2);
        loggerInstance.raw(
            'Logger initialized with verbosity level:',
            loggerInstance.getVerbosityLevel()
        );
    } else if (verbosityLevel !== null) {
        loggerInstance.setVerbosityLevel(verbosityLevel);
    }
    return loggerInstance;
}

/**
 * Reset the logger instance (for testing)
 */
export function resetLogger() {
    loggerInstance = null;
}

/**
 * Initialize logger with configuration
 * @param {Object} config - Configuration object
 */
export function initializeLogger(config) {
    const verbosityLevel = config?.global?.verbosityLevel || 2;
    if (loggerInstance) {
        loggerInstance.setVerbosityLevel(verbosityLevel);
    } else {
        getLogger(verbosityLevel);
    }
}

export default Logger;
