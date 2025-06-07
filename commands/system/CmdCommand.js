import { InteractiveCommand } from '../base/BaseCommand.js';
import { getLogger }  from '../../logger.js';

class CmdCommand extends InteractiveCommand {
    constructor() {
        super('cmd', 'Executes terminal commands with AI assistance or directly.', ['execute']); // Added 'execute' as an alias
        this.logger = getLogger();
    }

    getRequiredDependencies() {
        return ['apiClient', 'toolManager', 'consoleInterface', 'configManager']; // Added configManager
    }

    getUsage() {
        return "/cmd <command_string> | /cmd ??? <natural_language_query>";
    }

    async implementation(args, context) {
        this.logger.info(`CmdCommand implementation called with args: '${args}'`);
        // configManager is no longer needed here as the global toggle is removed
        const { apiClient, toolManager, consoleInterface } = context;

        let commandToExecute = null;
        let originalUserQuery = args;

        if (args.startsWith('???')) {
            const naturalQuery = args.substring(3).trim();
            originalUserQuery = args;

            if (!naturalQuery) {
                consoleInterface.showError("Natural language query cannot be empty after '???'.");
                return this.createErrorResponse("Natural language query cannot be empty.");
            }

            consoleInterface.showMessage("Generating command from natural language query...", "AI");

            const promptMessages = [
                { role: 'system', content: 'You are an AI assistant that generates terminal commands based on natural language queries. Respond only with the generated command, without any explanation or conversational text. If you cannot generate a command, respond with "Error: Cannot generate command.".' },
                { role: 'user', content: `Generate a terminal command for: ${naturalQuery}` }
            ];

            let generatedCommand;
            try {
                const originalModel = apiClient.model;
                const originalClient = apiClient.client;
                apiClient._switchToModelLevel('fast');
                this.logger.info(`Switched to fast model: ${apiClient.model} for command generation.`);

                const response = await apiClient.client.chat.completions.create({
                    model: apiClient.model,
                    messages: promptMessages,
                    temperature: 0.2,
                });

                generatedCommand = response.choices[0].message.content.trim();

                apiClient.client = originalClient;
                apiClient.model = originalModel;
                this.logger.info(`Restored original model: ${apiClient.model}.`);

            } catch (error) {
                this.logger.error(error, 'Error generating command using AI');
                consoleInterface.showError('Failed to generate command using AI.');
                return this.createErrorResponse('AI command generation failed.');
            }

            if (generatedCommand.startsWith('Error:') || !generatedCommand) {
                consoleInterface.showError(`AI could not generate a command for your query. AI response: ${generatedCommand}`);
                return this.createErrorResponse('AI could not generate a command.');
            }

            consoleInterface.showMessage(`Suggested command: \`${generatedCommand}\``, "AI");

            const confirmedToExecute = await this.promptForConfirmation('Do you want to execute this command?', context);
            if (confirmedToExecute) {
                commandToExecute = generatedCommand;
            } else {
                consoleInterface.showMessage('Command execution cancelled by user.', "System");
                return true;
            }

        } else if (args.trim()) {
            commandToExecute = args.trim();
        } else {
            consoleInterface.showError('No command provided. Usage: /cmd <command> OR /cmd ??? <query>');
            return this.createErrorResponse("No command provided.");
        }

        if (commandToExecute) {
            consoleInterface.logger.status(`
⏳ Executing command: \`${commandToExecute}\` ...`);
            let executionResult;
            try {
                executionResult = await toolManager.executeTool('execute_terminal', { command: commandToExecute });
                this.logger.info('Command execution result:', executionResult);

            } catch (error) {
                this.logger.error(error, `Error executing command: ${commandToExecute}`);
                consoleInterface.showError(`Failed to execute command: ${commandToExecute}. Error: ${error.message}`);
                executionResult = {
                    success: false,
                    stdout: '',
                    stderr: `Execution Error: ${error.message}`,
                    error: error.message
                };
            }

            consoleInterface.newLine();
            if (executionResult.success) {
                consoleInterface.showMessage("✅ Command executed successfully:", "System");
            } else {
                consoleInterface.showMessage("❌ Command execution failed:", "System");
            }

            if (executionResult.stdout) {
                consoleInterface.logger.raw('--- STDOUT ---');
                consoleInterface.logger.raw(executionResult.stdout);
                consoleInterface.logger.raw('--- END STDOUT ---');
            }
            if (executionResult.stderr) {
                consoleInterface.logger.raw('--- STDERR ---');
                consoleInterface.logger.raw(executionResult.stderr);
                consoleInterface.logger.raw('--- END STDERR ---');
            }
            if (!executionResult.stdout && !executionResult.stderr && executionResult.success) {
                consoleInterface.logger.raw('(Command produced no output)');
            }
            consoleInterface.newLine();

            // === New Prompt for History Logging ===
            const confirmedToLog = await this.promptForConfirmation('Do you want to add this command and its results to the chat history?', context);

            if (confirmedToLog) {
                let historyMessage = `Command executed: /cmd ${originalUserQuery}
`;
                historyMessage += `Actual command: ${commandToExecute}
`; // Log the actual command run
                historyMessage += `Status: ${executionResult.success ? 'Success' : 'Failed'}
`;
                if (executionResult.stdout) {
                    historyMessage += `Output (stdout):
${executionResult.stdout}
`;
                }
                if (executionResult.stderr) {
                    historyMessage += `Output (stderr):
${executionResult.stderr}
`;
                }

                if (context.apiClient && typeof context.apiClient.addMessageToHistory === 'function') {
                    context.apiClient.addMessageToHistory({ role: 'user', content: historyMessage });
                } else if (context.apiClient && context.apiClient.messages) {
                    context.apiClient.messages.push({ role: 'user', content: historyMessage });
                }
                consoleInterface.showMessage("Command and results added to chat history for context.", "System");
            } else {
                consoleInterface.showMessage("Command and results were NOT added to chat history.", "System");
            }
        }

        return true;
    }
}

export default CmdCommand;
