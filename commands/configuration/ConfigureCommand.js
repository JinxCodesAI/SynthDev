/**
 * Configure Command
 * Interactive configuration wizard for Synth-Dev setup
 */

import BaseCommand from '../base/BaseCommand.js';
import { ConfigurationWizard } from '../../utils/ConfigurationWizard.js';
import { getLogger } from '../../logger.js';

export class ConfigureCommand extends BaseCommand {
    constructor() {
        super();
        this.name = 'configure';
        this.category = 'configuration';
        this.description = 'Interactive configuration wizard for Synth-Dev setup';
        this.logger = getLogger();
    }

    /**
     * Execute the configure command
     * @param {string} args - Command arguments
     * @param {Object} context - Execution context
     * @returns {Promise<string>} Execution result
     */
    async execute(args, context) {
        try {
            // Parse arguments
            const trimmedArgs = args.trim().toLowerCase();

            if (trimmedArgs === 'help' || trimmedArgs === '--help') {
                this._showHelp();
                return true;
            }

            // Check if user wants to force reconfiguration
            const forceReconfigure = trimmedArgs === 'force' || trimmedArgs === '--force';

            if (!forceReconfigure) {
                // Check current configuration status
                const configManager = context.app?.config;
                if (configManager) {
                    const status = configManager.isConfigurationComplete();

                    if (status.isComplete) {
                        const shouldReconfigure = await this._confirmReconfiguration();
                        if (!shouldReconfigure) {
                            this.logger.user('Configuration cancelled.');
                            return true;
                        }
                    }
                }
            }

            // Start the configuration wizard
            this.logger.user('Starting configuration wizard...\n');

            const wizard = new ConfigurationWizard();
            const success = await wizard.startWizard(false);

            if (success) {
                this.logger.user(
                    '🔄 Configuration updated. Please restart Synth-Dev for changes to take effect.'
                );

                // Offer to restart if we have app context
                if (context.app) {
                    const shouldRestart = await this._confirmRestart();
                    if (shouldRestart) {
                        this.logger.user('Restarting Synth-Dev...');
                        // Trigger graceful restart
                        process.exit(0);
                    }
                }
            }

            return true;
        } catch (error) {
            this.logger.error(error, 'Error in configure command');
            this.logger.user('❌ Configuration failed. Please try again.');
            return 'error';
        }
    }

    /**
     * Show help for the configure command
     * @private
     */
    _showHelp() {
        console.log('\n🔧 Configure Command Help');
        console.log('═'.repeat(40));
        console.log('Interactive wizard to set up Synth-Dev configuration.\n');

        console.log('Usage:');
        console.log('  /configure           - Start configuration wizard');
        console.log('  /configure force     - Force reconfiguration (skip confirmation)');
        console.log('  /configure help      - Show this help\n');

        console.log('The wizard will guide you through:');
        console.log('  • Choosing an AI provider (OpenAI, Google, Anthropic, etc.)');
        console.log('  • Selecting a model');
        console.log('  • Entering your API key');
        console.log('  • Configuring optional settings\n');

        console.log('Configuration is saved to .env file in the Synth-Dev directory.');
        console.log('You can run this command anytime to update your configuration.\n');
    }

    /**
     * Confirm reconfiguration when config already exists
     * @private
     * @returns {Promise<boolean>} Whether to proceed with reconfiguration
     */
    async _confirmReconfiguration() {
        console.log('\n⚠️  Configuration already exists and appears complete.');
        console.log('Running the wizard will update your current configuration.\n');

        return await this._promptConfirmation('Do you want to reconfigure? (y/N): ');
    }

    /**
     * Confirm restart after configuration
     * @private
     * @returns {Promise<boolean>} Whether to restart
     */
    async _confirmRestart() {
        console.log('\n🔄 Configuration has been updated.');
        console.log('Synth-Dev needs to restart to apply the new configuration.\n');

        return await this._promptConfirmation('Restart now? (Y/n): ', true);
    }

    /**
     * Prompt for yes/no confirmation
     * @private
     * @param {string} message - Confirmation message
     * @param {boolean} defaultYes - Default to yes if true
     * @returns {Promise<boolean>} User confirmation
     */
    async _promptConfirmation(message, defaultYes = false) {
        const { createInterface } = await import('readline');

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise(resolve => {
            rl.question(message, answer => {
                rl.close();

                const trimmed = answer.trim().toLowerCase();

                if (trimmed === '') {
                    resolve(defaultYes);
                } else if (trimmed === 'y' || trimmed === 'yes') {
                    resolve(true);
                } else if (trimmed === 'n' || trimmed === 'no') {
                    resolve(false);
                } else {
                    // Invalid input, use default
                    resolve(defaultYes);
                }
            });
        });
    }

    /**
     * Get command help text
     * @returns {string} Help text
     */
    getHelp() {
        return 'Interactive configuration wizard for Synth-Dev setup';
    }

    /**
     * Get command usage text
     * @returns {string} Usage text
     */
    getUsage() {
        return '/configure [force|help] - Start configuration wizard';
    }

    /**
     * Get detailed command information
     * @returns {Object} Command information
     */
    getInfo() {
        return {
            name: this.name,
            category: this.category,
            description: this.description,
            usage: this.getUsage(),
            help: this.getHelp(),
            examples: [
                '/configure - Start configuration wizard',
                '/configure force - Force reconfiguration',
                '/configure help - Show help',
            ],
        };
    }
}

export default ConfigureCommand;
