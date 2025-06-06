import { createInterface } from 'readline';
import { getLogger } from './logger.js';

/**
 * Handles all console interface operations
 */
class ConsoleInterface {
    constructor() {
        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '💭 You: '
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

    showMessage(message, prefix = '🤖 Synth-Dev:') {
        this.logger.user(message, prefix);
    }

    showThinking() {
        this.logger.status('\n🧠 Synth-Dev is thinking...\n');
    }

    showChainOfThought(content) {
        this.logger.raw('💭 Chain of Thought:');
        this.logger.raw('─'.repeat(50));
        this.logger.raw(content);
        this.logger.raw('─'.repeat(50));
        this.logger.raw();
    }

    showFinalChainOfThought(content) {
        this.logger.raw('💭 Final Chain of Thought:');
        this.logger.raw('─'.repeat(50));
        this.logger.raw(content);
        this.logger.raw('─'.repeat(50));
        this.logger.raw();
    }

    showToolExecution(toolName, args) {
        this.logger.toolExecutionDetailed(toolName, args);
    }

    showToolResult(result) {
        this.logger.toolResult(result);
    }

    showToolError(error) {
        this.logger.error(error, 'Tool execution failed');
    }

    showExecutingTools() {
        this.logger.status('🔧 Executing tools...\n');
    }

    showError(error) {
        this.logger.error(error);
    }

    showStartupMessage(model, totalToolsCount, role = null, allToolsCount = null, filteredToolsCount = null) {
        const roleInfo = role ? `\n🎭 Role: ${role.charAt(0).toUpperCase() + role.slice(1)}` : '';
        const toolInfo = (allToolsCount !== null && filteredToolsCount !== null && allToolsCount !== filteredToolsCount)
            ? `🔧 Tools: ${filteredToolsCount}/${allToolsCount} available (${allToolsCount - filteredToolsCount} filtered for role)`
            : `🔧 Tools: ${totalToolsCount} loaded`;

        this.logger.raw(`
🚀 Synth-Dev Console Application Started!
🤖 Model: ${model}${roleInfo}
${toolInfo}

Type your message and press Enter to chat.
Use /help for commands.
        `);
    }

    showGoodbye() {
        this.logger.raw('👋 Goodbye!');
    }

    newLine() {
        this.logger.raw();
    }

    close() {
        this.rl.close();
    }

    async promptForConfirmation(prompt) {
        return new Promise((resolve) => {
            this.logger.raw('\n❓ ' + prompt);
            this.logger.raw('   Type "y" or "yes" to proceed, anything else to cancel:');

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
            const confirmationHandler = (input) => {
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
        this.logger.warn(`Tool execution cancelled: ${toolName}\n`, '🚫');
    }

    showEnhancingPrompt() {
        this.logger.status('\n🔄 \x1b[33mEnhancing prompt...\x1b[0m');
    }

    showEnhancementError(error) {
        this.logger.warn(`\n⚠️  \x1b[33mPrompt enhancement failed: ${error}\x1b[0m`);
        this.logger.info('📝 Proceeding with original prompt...\n');
    }

    async promptForEnhancedPromptApproval(enhancedPrompt, originalPrompt) {
        this.logger.raw('🔄 Press Esc to revert to original or ENTER to submit current prompt');

        // Show the enhanced prompt as editable input
        const userInput = await this.promptForEditableInput('💭 You: ', enhancedPrompt, originalPrompt);

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
        return new Promise((resolve) => {
            // Store current paused state and listeners
            const wasPaused = this.isPaused;
            const currentListeners = this.rl.listeners('line');

            // Remove all existing 'line' listeners to prevent interference
            this.rl.removeAllListeners('line');

            // Temporarily resume input
            if (wasPaused) {
                this.isPaused = false;
                this.rl.resume();
            }

            // Show prompt and pre-filled text
            process.stdout.write(prompt);
            process.stdout.write(prefillText);

            // Set up input handling
            let inputBuffer = prefillText;
            let isEscapePressed = false;

            const handleKeypress = (str, key) => {
                if (!key) return;

                if (key.name === 'escape') {
                    isEscapePressed = true;
                    // Clear the line and show original
                    process.stdout.write('\r\x1b[K');
                    process.stdout.write(prompt + originalText);
                    inputBuffer = originalText;
                    return;
                }

                // Handle basic editing
                if (key.name === 'backspace') {
                    if (inputBuffer.length > 0) {
                        inputBuffer = inputBuffer.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
                    inputBuffer += str;
                    process.stdout.write(str);
                }
            };

            const handleLine = (input) => {
                // Clean up
                process.stdin.removeListener('keypress', handleKeypress);
                this.rl.removeListener('line', handleLine);

                // Restore original listeners
                currentListeners.forEach(listener => {
                    this.rl.on('line', listener);
                });

                // Restore previous paused state
                if (wasPaused) {
                    this.isPaused = true;
                    this.rl.pause();
                }

                if (isEscapePressed) {
                    resolve(null); // Signal escape was pressed
                } else {
                    // Return the inputBuffer which contains the actual displayed text,
                    // not the readline input which might be empty
                    resolve(inputBuffer);
                }
            };

            // Set up listeners
            process.stdin.on('keypress', handleKeypress);
            this.rl.on('line', handleLine);
        });
    }

    async promptForEnhancementFailureAction(error, originalPrompt) {
        this.logger.raw('\n⚠️  \x1b[33mPrompt enhancement failed:\x1b[0m');
        this.logger.raw(`   ${error}`);
        this.logger.raw('\n📝 \x1b[36mOriginal prompt:\x1b[0m');
        this.logger.raw('─'.repeat(60));
        this.logger.raw(originalPrompt);
        this.logger.raw('─'.repeat(60));
        this.logger.raw('\n📝 You can:');
        this.logger.raw('   • Press ENTER to use your original prompt');
        this.logger.raw('   • Type your modifications and press ENTER');
        this.logger.raw('   • Type "cancel" to cancel the operation');

        const userInput = await this.promptForInput('\n💭 Your choice: ');

        if (userInput.trim().toLowerCase() === 'cancel') {
            return { cancel: true };
        } else if (userInput.trim() === '') {
            return { useOriginal: true };
        } else {
            return { useModified: true, finalPrompt: userInput.trim() };
        }
    }

    async promptForInput(prompt) {
        return new Promise((resolve) => {
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
            const inputHandler = (input) => {
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


}

export default ConsoleInterface; 