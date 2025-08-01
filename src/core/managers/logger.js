import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';

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
        this.logFilePath = null;
        this.fileLoggingEnabled = false;

        // Initialize file logging if verbosity level is 5
        if (verbosityLevel >= 5) {
            this._initializeFileLogging();
        }
    }

    /**
     * Initialize file logging for verbosity level 5
     * @private
     */
    _initializeFileLogging() {
        try {
            // Create .synthdev/logs directory if it doesn't exist
            const logsDir = join(process.cwd(), '.synthdev', 'logs');
            if (!existsSync(logsDir)) {
                mkdirSync(logsDir, { recursive: true });
            }

            // Generate unique log file name with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logFileName = `synthdev-${timestamp}.log`;
            this.logFilePath = join(logsDir, logFileName);

            // Create initial log file with header
            const header = `=== Synth-Dev Log Session Started ===\nTimestamp: ${new Date().toISOString()}\nVerbosity Level: ${this.verbosityLevel}\n${'='.repeat(50)}\n\n`;
            writeFileSync(this.logFilePath, header, 'utf8');

            this.fileLoggingEnabled = true;
            console.log(`📝 File logging enabled: ${this.logFilePath}`);
        } catch (error) {
            console.error('❌ Failed to initialize file logging:', error.message);
            this.fileLoggingEnabled = false;
        }
    }

    /**
     * Write message to log file
     * @private
     * @param {string} message - Message to write to file
     */
    _writeToFile(message) {
        if (this.fileLoggingEnabled && this.logFilePath) {
            try {
                const timestamp = new Date().toISOString();
                const logEntry = `[${timestamp}] ${message}\n`;
                appendFileSync(this.logFilePath, logEntry, 'utf8');
            } catch (error) {
                console.error('❌ Failed to write to log file:', error.message);
            }
        }
    }

    /**
     * Set the verbosity level
     * @param {number} level - Verbosity level (0-5)
     */
    setVerbosityLevel(level) {
        this.raw(`Setting verbosity level to:${level}`);
        if (level >= 0 && level <= 5) {
            const oldLevel = this.verbosityLevel;
            this.verbosityLevel = level;

            // Initialize file logging if switching to level 5
            if (level >= 5 && oldLevel < 5 && !this.fileLoggingEnabled) {
                this._initializeFileLogging();
            }

            // Log the level change to file if file logging is enabled
            if (this.fileLoggingEnabled) {
                this._writeToFile(`Verbosity level changed from ${oldLevel} to ${level}`);
            }
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
            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                this._writeToFile(`${prefix} ${message}`);
            }
        }
    }

    /**
     * Level 1: Short status messages
     * @param {string} message - Message to log
     */
    status(message) {
        if (this.verbosityLevel >= 1) {
            console.log(message);
            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                this._writeToFile(`STATUS: ${message}`);
            }
        }
    }

    /**
     * Level 2: Tool execution with compressed arguments (default level)
     * @param {string} toolName - Name of the tool
     * @param {string} role - Role of the tool
     * @param {Object} args - Tool arguments
     */
    toolExecution(toolName, role, args) {
        if (this.verbosityLevel >= 2) {
            console.log(`🔧 Role: ${role} Executing tool: ${toolName}`);
            const compressedArgs = this._compressArguments(args);
            console.log('📝 Arguments:', compressedArgs);

            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                this._writeToFile(
                    `TOOL EXECUTION: Role: ${role} Executing tool: ${toolName}\nArguments: ${JSON.stringify(compressedArgs, null, 2)}`
                );
            }
        }
    }

    /**
     * Level 3: Uncompressed arguments but no results
     * @param {string} toolName - Name of the tool
     * @param {string} role - Role of the tool
     * @param {Object} args - Tool arguments
     */
    toolExecutionDetailed(toolName, role, args) {
        if (this.verbosityLevel >= 3) {
            console.log(`🔧 Role: ${role} Executing tool: ${toolName}`);
            console.log('📝 Arguments:', args);

            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                this._writeToFile(
                    `TOOL EXECUTION DETAILED: Role: ${role} Executing tool: ${toolName}\nArguments: ${JSON.stringify(args, null, 2)}`
                );
            }
        } else if (this.verbosityLevel === 2) {
            this.toolExecution(toolName, role, args);
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

            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                this._writeToFile(`TOOL RESULT: ${JSON.stringify(result, null, 2)}`);
            }
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
            const consoleOutput = [
                `\n🌐 HTTP ${method} Request [${timestamp}]`,
                `📍 URL: ${url}`,
                `📤 Request: ${JSON.stringify(requestData, null, 2)}`,
            ];

            if (responseData) {
                consoleOutput.push(`📥 Response: ${JSON.stringify(responseData, null, 2)}`);
            }
            consoleOutput.push('─'.repeat(80));

            // Output to console
            consoleOutput.forEach(line => console.log(line));

            // Also log to file if file logging is enabled
            if (this.fileLoggingEnabled) {
                const fileOutput = [
                    `HTTP ${method} Request`,
                    `URL: ${url}`,
                    `Request: ${JSON.stringify(requestData, null, 2)}`,
                ];

                if (responseData) {
                    fileOutput.push(`Response: ${JSON.stringify(responseData, null, 2)}`);
                }
                fileOutput.push('─'.repeat(80));

                this._writeToFile(fileOutput.join('\n'));
            }
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

        // Always log errors to file if file logging is enabled
        if (this.fileLoggingEnabled) {
            let errorDetails = `ERROR: ${prefix} ${message}`;
            if (error instanceof Error && error.response?.data) {
                errorDetails += `\nResponse data: ${JSON.stringify(error.response.data, null, 2)}`;
            }
            this._writeToFile(errorDetails);
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

            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                this._writeToFile(`WARNING: ${prefix} ${message}`);
            }
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

            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                let debugEntry = `DEBUG: ${message}`;
                if (data !== null) {
                    debugEntry += `\nData: ${JSON.stringify(data, null, 2)}`;
                }
                this._writeToFile(debugEntry);
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

            // Log to file if verbosity is 5
            if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
                this._writeToFile(`INFO: ${message}`);
            }
        }
    }

    /**
     * Raw console.log (always visible - use sparingly)
     * @param {...any} args - Arguments to log
     */
    raw(...args) {
        console.log(...args);

        // Log to file if verbosity is 5
        if (this.verbosityLevel >= 5 && this.fileLoggingEnabled) {
            const message = args
                .map(arg => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
                .join(' ');
            this._writeToFile(`RAW: ${message}`);
        }
    }

    /**
     * Close the log file and add session end marker
     */
    closeLogFile() {
        if (this.fileLoggingEnabled && this.logFilePath) {
            try {
                // Check if file exists before trying to append
                if (existsSync(this.logFilePath)) {
                    const footer = `\n${'='.repeat(50)}\n=== Synth-Dev Log Session Ended ===\nTimestamp: ${new Date().toISOString()}\n${'='.repeat(50)}\n`;
                    appendFileSync(this.logFilePath, footer, 'utf8');
                }
                this.fileLoggingEnabled = false;
                this.logFilePath = null;
            } catch (error) {
                console.error('❌ Failed to close log file:', error.message);
            }
        }
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

    /**
     * Get the current log file path
     * @returns {string|null} Current log file path or null if file logging is disabled
     */
    getLogFilePath() {
        return this.fileLoggingEnabled ? this.logFilePath : null;
    }

    /**
     * Check if file logging is enabled
     * @returns {boolean} True if file logging is enabled
     */
    isFileLoggingEnabled() {
        return this.fileLoggingEnabled;
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
    if (loggerInstance) {
        loggerInstance.closeLogFile();
    }
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
