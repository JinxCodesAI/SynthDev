import { createInterface } from 'readline';
import { getLogger } from '../managers/logger.js';
import { getUIConfigManager } from '../../config/managers/uiConfigManager.js';

/**
 * Handles all console interface operations
 */
class ConsoleInterface {
    constructor() {
        this.uiConfig = getUIConfigManager();
        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.uiConfig.getMessage('prompts.user'),
        });
        this.isPaused = false;
        this.logger = getLogger();
    }

    setupEventHandlers(onInput, onClose) {
        this.rl.on('line', onInput);
        this.rl.on('close', onClose);
    }

    prompt() {
        if (!this.isPaused) {
            this.rl.prompt();
        }
    }

    pauseInput() {
        this.isPaused = true;
        this.rl.pause();
    }

    resumeInput() {
        this.isPaused = false;
        this.rl.resume();
        this.rl.prompt();
    }

    showMessage(message, prefix = null) {
        const actualPrefix = prefix || this.uiConfig.getMessage('prefixes.assistant');
        this.logger.user(message, actualPrefix);
    }

    showThinking() {
        this.logger.status(this.uiConfig.getMessage('status.thinking'));
    }

    showChainOfThought(content) {
        const prefix = this.uiConfig.getMessage('prefixes.chain_of_thought');
        const separator = this.uiConfig.getMessage('prefixes.separator').repeat(50);
        this.logger.debug(prefix);
        this.logger.debug(separator);
        this.logger.debug(content);
        this.logger.debug(separator);
        this.logger.raw();
    }

    showFinalChainOfThought(content) {
        const prefix = this.uiConfig.getMessage('prefixes.final_chain_of_thought');
        const separator = this.uiConfig.getMessage('prefixes.separator').repeat(50);
        this.logger.info(prefix);
        this.logger.info(separator);
        this.logger.info(content);
        this.logger.info(separator);
        this.logger.raw();
    }

    showToolExecution(toolName, args) {
        this.logger.toolExecutionDetailed(toolName, args);
    }

    showToolResult(result) {
        this.logger.toolResult(result);
    }

    showToolError(error) {
        this.logger.error(error, this.uiConfig.getMessage('errors.tool_execution_failed'));
    }

    showExecutingTools() {
        this.logger.status(this.uiConfig.getMessage('status.executing_tools'));
    }

    showError(error) {
        this.logger.error(error);
    }

    showStartupMessage(
        model,
        totalToolsCount,
        role = null,
        allToolsCount = null,
        filteredToolsCount = null,
        envInfo = null,
        gitInfo = null
    ) {
        const title = this.uiConfig.getMessage('startup.title');
        const modelInfo = this.uiConfig.getMessage('startup.model_info', { model });
        const roleInfo = role
            ? `\n${this.uiConfig.getMessage('startup.role_info', { role: role.charAt(0).toUpperCase() + role.slice(1) })}`
            : '';

        const toolInfo =
            allToolsCount !== null &&
            filteredToolsCount !== null &&
            allToolsCount !== filteredToolsCount
                ? this.uiConfig.getMessage('startup.tools_filtered_info', {
                      filtered: filteredToolsCount,
                      total: allToolsCount,
                      excluded: allToolsCount - filteredToolsCount,
                  })
                : this.uiConfig.getMessage('startup.tools_info', { count: totalToolsCount });

        const envInfoLine = envInfo
            ? `\n${this.uiConfig.getMessage('startup.env_info', { envStatus: envInfo })}`
            : '';

        const gitInfoLine = gitInfo
            ? `\n${this.uiConfig.getMessage('startup.git_info', { gitStatus: gitInfo })}`
            : '';

        const instructions = this.uiConfig.getMessage('startup.instructions');

        this.logger.user(`
${title}
${modelInfo}${roleInfo}
${toolInfo}${envInfoLine}${gitInfoLine}

${instructions}
        `);
    }

    showGoodbye() {
        this.logger.user(this.uiConfig.getMessage('goodbye'));
    }

    newLine() {
        this.logger.raw();
    }

    close() {
        this.rl.close();
    }

    async promptForConfirmation(prompt) {
        return new Promise(resolve => {
            const confirmationMessage = this.uiConfig.getMessage('prompts.confirmation', {
                prompt,
            });
            this.logger.user(confirmationMessage);

            // Store current paused state
            const wasPaused = this.isPaused;

            // Store current listeners to temporarily remove them
            const currentListeners = this.rl.listeners('line');

            // Remove all existing 'line' listeners to prevent interference
            this.rl.removeAllListeners('line');

            // Temporarily resume input for confirmation
            if (wasPaused) {
                this.isPaused = false;
                this.rl.resume();
            }

            // Set up one-time confirmation handler
            const confirmationHandler = input => {
                const response = input.trim().toLowerCase();
                const confirmed = response === 'y' || response === 'yes';

                // Remove the confirmation handler
                this.rl.removeListener('line', confirmationHandler);

                // Restore all original listeners
                currentListeners.forEach(listener => {
                    this.rl.on('line', listener);
                });

                // Restore previous paused state
                if (wasPaused) {
                    this.isPaused = true;
                    this.rl.pause();
                }

                this.logger.raw(); // Add spacing
                resolve(confirmed);
            };

            this.rl.on('line', confirmationHandler);
        });
    }

    showToolCancelled(toolName) {
        const message = this.uiConfig.getMessage('tools.cancelled', { toolName });
        this.logger.warn(message, '🚫');
    }

    showEnhancingPrompt() {
        this.logger.status(this.uiConfig.getMessage('status.enhancing_prompt'));
    }

    showEnhancementError(error) {
        const errorMessage = this.uiConfig.getMessage('enhancement.failure_message', { error });
        const proceedingMessage = this.uiConfig.getMessage('enhancement.proceeding_message');
        this.logger.warn(errorMessage);
        this.logger.info(proceedingMessage);
    }

    async promptForEnhancedPromptApproval(enhancedPrompt, originalPrompt) {
        this.logger.user(this.uiConfig.getMessage('enhancement.approval_instruction'));

        // Show the enhanced prompt as editable input
        const userPrompt = this.uiConfig.getMessage('prompts.user');
        const userInput = await this.promptForEditableInput(
            userPrompt,
            enhancedPrompt,
            originalPrompt
        );

        if (userInput === null) {
            // User pressed Escape - revert to original
            return { useOriginal: true };
        } else if (userInput.trim() === originalPrompt.trim()) {
            return { useOriginal: true };
        } else if (userInput.trim() === enhancedPrompt.trim()) {
            return { useEnhanced: true, finalPrompt: enhancedPrompt };
        } else {
            return { useModified: true, finalPrompt: userInput.trim() };
        }
    }

    /**
     * Prompt for editable input with pre-filled text and escape handling
     * @private
     */
    async promptForEditableInput(prompt, prefillText, originalText) {
        return new Promise(resolve => {
            // Store current paused state and listeners
            const wasPaused = this.isPaused;
            const currentListeners = this.rl.listeners('line');

            // Remove all existing 'line' listeners to prevent interference
            this.rl.removeAllListeners('line');

            // Pause the readline interface to prevent double input
            this.rl.pause();

            // Enable raw mode to handle individual keystrokes
            process.stdin.setRawMode(true);
            process.stdin.resume();

            // Show prompt and pre-filled text
            process.stdout.write(prompt);
            process.stdout.write(prefillText);

            // Set up input handling
            let inputBuffer = prefillText;
            let cursorPos = prefillText.length;
            let isEscapePressed = false;
            const promptLength = prompt.length;

            const redrawLine = () => {
                // Clear the entire line and redraw
                process.stdout.write('\r\x1b[K');
                process.stdout.write(prompt + inputBuffer);
                // Move cursor to correct position
                const targetPos = promptLength + cursorPos;
                const currentPos = promptLength + inputBuffer.length;
                if (targetPos < currentPos) {
                    process.stdout.write(`\x1b[${currentPos - targetPos}D`);
                }
            };

            const handleKeypress = chunk => {
                const key = chunk[0];

                // Handle Escape key
                if (key === 27) {
                    isEscapePressed = true;
                    inputBuffer = originalText;
                    cursorPos = originalText.length;
                    redrawLine();
                    return;
                }

                // Handle Enter key
                if (key === 13) {
                    process.stdout.write('\n');
                    cleanup();
                    if (isEscapePressed) {
                        resolve(null);
                    } else {
                        resolve(inputBuffer);
                    }
                    return;
                }

                // Handle Backspace
                if (key === 127 || key === 8) {
                    if (cursorPos > 0) {
                        inputBuffer =
                            inputBuffer.slice(0, cursorPos - 1) + inputBuffer.slice(cursorPos);
                        cursorPos--;
                        redrawLine();
                    }
                    return;
                }

                // Handle Delete key (ESC sequence)
                if (key === 27 && chunk.length === 3 && chunk[1] === 91 && chunk[2] === 51) {
                    // This is the start of a delete sequence, wait for the next chunk
                    return;
                }

                // Handle arrow keys
                if (key === 27 && chunk.length >= 3 && chunk[1] === 91) {
                    if (chunk[2] === 67) {
                        // Right arrow
                        if (cursorPos < inputBuffer.length) {
                            cursorPos++;
                            process.stdout.write('\x1b[C');
                        }
                    } else if (chunk[2] === 68) {
                        // Left arrow
                        if (cursorPos > 0) {
                            cursorPos--;
                            process.stdout.write('\x1b[D');
                        }
                    }
                    return;
                }

                // Handle Ctrl+C
                if (key === 3) {
                    process.stdout.write('\n');
                    cleanup();
                    resolve(null);
                    return;
                }

                // Handle printable characters
                if (key >= 32 && key <= 126) {
                    const char = String.fromCharCode(key);
                    inputBuffer =
                        inputBuffer.slice(0, cursorPos) + char + inputBuffer.slice(cursorPos);
                    cursorPos++;
                    redrawLine();
                }
            };

            const cleanup = () => {
                // Restore normal mode
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdin.removeListener('data', handleKeypress);

                // Restore readline interface
                if (!wasPaused) {
                    this.isPaused = false;
                    this.rl.resume();
                }

                // Restore original listeners
                currentListeners.forEach(listener => {
                    this.rl.on('line', listener);
                });
            };

            // Set up listener
            process.stdin.on('data', handleKeypress);
        });
    }

    async promptForEnhancementFailureAction(error, originalPrompt) {
        this.logger.user(this.uiConfig.getMessage('enhancement.failure_header'));
        this.logger.user(`   ${error}`);
        this.logger.user(this.uiConfig.getMessage('enhancement.original_prompt_header'));
        this.logger.user(this.uiConfig.getMessage('enhancement.separator').repeat(60));
        this.logger.user(originalPrompt);
        this.logger.user(this.uiConfig.getMessage('enhancement.separator').repeat(60));
        this.logger.user(this.uiConfig.getMessage('enhancement.options_header'));
        this.logger.user(this.uiConfig.getMessage('enhancement.option_enter'));
        this.logger.user(this.uiConfig.getMessage('enhancement.option_modify'));
        this.logger.user(this.uiConfig.getMessage('enhancement.option_cancel'));

        const userInput = await this.promptForInput(
            this.uiConfig.getMessage('enhancement.choice_prompt')
        );

        const cancelKeyword = this.uiConfig.getMessage('enhancement.cancel_keyword');
        if (userInput.trim().toLowerCase() === cancelKeyword) {
            return { cancel: true };
        } else if (userInput.trim() === '') {
            return { useOriginal: true };
        } else {
            return { useModified: true, finalPrompt: userInput.trim() };
        }
    }

    async promptForInput(prompt) {
        return new Promise(resolve => {
            // Store current paused state and listeners
            const wasPaused = this.isPaused;
            const currentListeners = this.rl.listeners('line');

            // Remove all existing 'line' listeners to prevent interference
            this.rl.removeAllListeners('line');

            // Temporarily resume input for custom prompt
            if (wasPaused) {
                this.isPaused = false;
                this.rl.resume();
            }

            // Set up one-time input handler
            const inputHandler = input => {
                // Remove the input handler
                this.rl.removeListener('line', inputHandler);

                // Restore all original listeners
                currentListeners.forEach(listener => {
                    this.rl.on('line', listener);
                });

                // Restore previous paused state
                if (wasPaused) {
                    this.isPaused = true;
                    this.rl.pause();
                }

                resolve(input);
            };

            this.rl.on('line', inputHandler);

            // Show custom prompt
            process.stdout.write(prompt);
        });
    }

    /**
     * Displays a status message above the current prompt line.
     * @param {string} message - The status message to display.
     */
    showWorkflowStatus(message) {
        const prompt = this.rl.prompt();
        const cursorPos = this.rl.cursor;
        const line = this.rl.line;

        // Clear the current line
        process.stdout.write('\x1b[2K\r');

        // Write the status message
        process.stdout.write(`${message}\n`);

        // Redraw the prompt and user's current input
        process.stdout.write(prompt + line);

        // Restore cursor position
        process.stdout.write(`\x1b[${cursorPos + prompt.length}G`);
    }
}

export default ConsoleInterface;
