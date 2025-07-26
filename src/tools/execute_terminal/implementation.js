/**
 * Execute Terminal tool implementation
 * Executes terminal commands and returns their output with comprehensive error handling
 * Uses ShellDetector to properly handle PowerShell and CMD commands on Windows
 */

import { spawn } from 'child_process';
import { CommandBaseTool } from '../common/base-tool.js';
import { shellDetector } from './shellDetector.js';

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

        return new Promise(resolve => {
            this.logger.debug(`Executing terminal command: ${command}`);

            // Detect appropriate shell for the command
            const shellConfig = shellDetector.detectShell(command);
            const executionParams = shellDetector.formatCommand(command, shellConfig);

            this.logger.debug(`Using shell: ${shellConfig.type} (${shellConfig.executable})`);

            // Execute using spawn with proper shell
            const child = spawn(
                executionParams.executable,
                executionParams.args,
                executionParams.options
            );

            let stdout = '';
            let stderr = '';

            // Collect stdout
            child.stdout.on('data', data => {
                stdout += data.toString();
            });

            // Collect stderr
            child.stderr.on('data', data => {
                stderr += data.toString();
            });

            // Handle process completion
            child.on('close', code => {
                if (code === 0) {
                    resolve(this.createCommandResponse(true, stdout, stderr));
                } else {
                    const errorMessage = `Command exited with code ${code}`;
                    resolve(this.createCommandResponse(false, stdout, stderr, errorMessage));
                }
            });

            // Handle process errors
            child.on('error', error => {
                resolve(this.createCommandResponse(false, stdout, stderr, error.message));
            });
        });
    }
}

// Create and export the tool instance
const executeTerminalTool = new ExecuteTerminalTool();

export default async function executeTerminal(params) {
    return await executeTerminalTool.execute(params);
}
