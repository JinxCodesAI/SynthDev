/**
 * Execute Terminal tool implementation
 * Executes terminal commands and returns their output with comprehensive error handling
 * Supports cross-platform shell detection and PowerShell execution on Windows
 */

import { exec, spawn } from 'child_process';
import { CommandBaseTool } from '../common/base-tool.js';
import { getShellForCommand } from '../../utils/shellDetection.js';

class ExecuteTerminalTool extends CommandBaseTool {
    constructor() {
        super('execute_terminal', 'Executes a terminal command and returns its output');

        // Define parameter validation
        this.requiredParams = ['command'];
        this.parameterTypes = {
            command: 'string',
        };
    }

    async implementation(params) {
        const { command } = params;

        // Validate command input
        const commandValidation = this.validateCommand(command);
        if (commandValidation) {
            return commandValidation;
        }

        try {
            // Detect the appropriate shell for this command
            const shellConfig = await getShellForCommand(command);
            this.logger.debug(`Executing command with ${shellConfig.type}: ${command}`);

            return await this._executeWithShell(command, shellConfig);
        } catch (error) {
            this.logger.error(`Shell detection failed: ${error.message}`);
            // Fallback to default exec behavior
            return await this._executeWithDefaultShell(command);
        }
    }

    /**
     * Execute command with the detected shell configuration
     * @private
     * @param {string} command - Command to execute
     * @param {Object} shellConfig - Shell configuration object
     * @returns {Promise<Object>} Command execution result
     */
    async _executeWithShell(command, shellConfig) {
        return new Promise(resolve => {
            const args = [...shellConfig.flags, command];

            this.logger.debug(`Spawning: ${shellConfig.executable} ${args.join(' ')}`);

            const childProcess = spawn(shellConfig.executable, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false, // We're explicitly specifying the shell
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout.on('data', data => {
                stdout += data.toString();
            });

            childProcess.stderr.on('data', data => {
                stderr += data.toString();
            });

            childProcess.on('close', code => {
                const success = code === 0;
                const errorMessage = success ? null : `Command exited with code ${code}`;
                resolve(this.createCommandResponse(success, stdout, stderr, errorMessage));
            });

            childProcess.on('error', error => {
                resolve(this.createCommandResponse(false, stdout, stderr, error.message));
            });

            // Set a timeout to prevent hanging commands
            const timeout = setTimeout(() => {
                childProcess.kill('SIGTERM');
                resolve(
                    this.createCommandResponse(
                        false,
                        stdout,
                        stderr,
                        'Command timed out after 30 seconds'
                    )
                );
            }, 30000);

            childProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Fallback method using the default exec behavior
     * @private
     * @param {string} command - Command to execute
     * @returns {Promise<Object>} Command execution result
     */
    async _executeWithDefaultShell(command) {
        return new Promise(resolve => {
            this.logger.debug(`Executing with default shell: ${command}`);
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    resolve(this.createCommandResponse(false, stdout, stderr, error.message));
                } else {
                    resolve(this.createCommandResponse(true, stdout, stderr));
                }
            });
        });
    }
}

// Create and export the tool instance
const executeTerminalTool = new ExecuteTerminalTool();

export default async function executeTerminal(params) {
    return await executeTerminalTool.execute(params);
}
