/**
 * Execute Terminal tool implementation
 * Executes terminal commands and returns their output with comprehensive error handling
 */

import { exec } from 'child_process';
import { CommandBaseTool } from '../common/base-tool.js';

class ExecuteTerminalTool extends CommandBaseTool {
    constructor() {
        super('execute_terminal', 'Executes a terminal command and returns its output');
        
        // Define parameter validation
        this.requiredParams = ['command'];
        this.parameterTypes = {
            command: 'string'
        };
    }

    async implementation(params) {
        const { command } = params;

        // Validate command input
        const commandValidation = this.validateCommand(command);
        if (commandValidation) {
            return commandValidation;
        }

        return new Promise((resolve) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    resolve(this.createCommandResponse(
                        false,
                        stdout,
                        stderr,
                        error.message
                    ));
                } else {
                    resolve(this.createCommandResponse(
                        true,
                        stdout,
                        stderr
                    ));
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