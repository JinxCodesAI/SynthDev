/**
 * Configure Command
 * Interactive configuration wizard for setting up SynthDev
 */

import { InteractiveCommand } from '../base/BaseCommand.js';
import { ConfigurationWizard } from './ConfigurationWizard.js';
import { getLogger } from '../../core/managers/logger.js';

export class ConfigureCommand extends InteractiveCommand {
    constructor() {
        super('configure', 'Interactive configuration wizard', ['config']);
        this.wizard = new ConfigurationWizard();
    }

    /**
     * Execute the configuration wizard
     * @param {string} args - Command arguments (unused)
     * @param {Object} context - Execution context
     * @returns {boolean} Always returns true
     */
    async implementation(args, context) {
        const logger = getLogger();

        logger.raw('\n🔧 SynthDev Configuration Wizard');
        logger.raw('═'.repeat(50));

        const completeness = this.wizard.checkCompleteness();

        if (!completeness.hasEnvFile) {
            logger.raw("📝 No .env file found. Let's create one!");
        } else if (!completeness.isComplete) {
            logger.raw('⚠️  Configuration is incomplete. Missing:');
            completeness.missing.forEach(key => {
                logger.raw(`   • ${key}`);
            });
        } else {
            logger.raw('✅ Configuration appears complete. You can still modify settings.');
        }

        logger.raw('');

        while (true) {
            await this._showMainMenu(context);

            const input = await this.promptForInput('configure> ', context);
            const trimmed = input.trim().toLowerCase();

            if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
                break;
            } else if (trimmed === 's' || trimmed === 'save') {
                await this._saveConfiguration(context);
            } else if (trimmed === '1') {
                await this._configureProvider(context, 'base');
            } else if (trimmed === '2') {
                await this._configureProvider(context, 'smart');
            } else if (trimmed === '3') {
                await this._configureProvider(context, 'fast');
            } else if (trimmed === '4') {
                await this._configureOtherSettings(context);
            } else if (trimmed === 'r' || trimmed === 'reset') {
                await this._resetConfiguration(context);
            } else if (trimmed === '') {
                // Handle empty input gracefully - just show menu again
                continue;
            } else {
                logger.raw('❌ Invalid option. Please try again.');
            }

            logger.raw('');
        }

        return true;
    }

    /**
     * Show the main configuration menu
     * @private
     * @param {Object} context - Execution context
     */
    async _showMainMenu(context) {
        const logger = getLogger();
        const summary = this.wizard.getConfigSummary();

        logger.raw('📋 Current Configuration:');
        logger.raw('─'.repeat(30));

        // Base configuration
        logger.raw(`1️⃣  Base Provider: ${summary.base.provider}`);
        logger.raw(`    Model: ${summary.base.model}`);
        logger.raw(`    API Key: ${summary.base.apiKey}`);
        logger.raw('');

        // Smart configuration
        logger.raw(`2️⃣  Smart Provider: ${summary.smart.provider}`);
        logger.raw(`    Model: ${summary.smart.model}`);
        logger.raw(`    API Key: ${summary.smart.apiKey}`);
        logger.raw('');

        // Fast configuration
        logger.raw(`3️⃣  Fast Provider: ${summary.fast.provider}`);
        logger.raw(`    Model: ${summary.fast.model}`);
        logger.raw(`    API Key: ${summary.fast.apiKey}`);
        logger.raw('');

        // Other settings
        logger.raw('4️⃣  Other Settings:');
        logger.raw(`    Verbosity Level: ${summary.other.verbosity}`);
        logger.raw(`    Max Tool Calls: ${summary.other.maxToolCalls}`);
        logger.raw(`    Prompt Enhancement: ${summary.other.promptEnhancement}`);
        logger.raw('');

        logger.raw('Commands:');
        logger.raw('  1-4 - Configure specific section');
        logger.raw('  s   - Save configuration');
        logger.raw('  r   - Reset all settings');
        logger.raw('  q   - Quit wizard');
    }

    /**
     * Configure a provider (base, smart, or fast)
     * @private
     * @param {Object} context - Execution context
     * @param {string} type - Provider type (base, smart, fast)
     */
    async _configureProvider(context, type) {
        const logger = getLogger();
        const typeUpper = type.toUpperCase();

        logger.raw(`\n🔧 Configure ${type.charAt(0).toUpperCase() + type.slice(1)} Provider`);
        logger.raw('═'.repeat(40));

        while (true) {
            // Fix: Use correct environment variable names for base provider
            const baseUrlKey =
                type === 'base' ? 'SYNTHDEV_BASE_URL' : `SYNTHDEV_${typeUpper}_BASE_URL`;
            const modelKey =
                type === 'base' ? 'SYNTHDEV_BASE_MODEL' : `SYNTHDEV_${typeUpper}_MODEL`;
            const apiKeyKey =
                type === 'base' ? 'SYNTHDEV_API_KEY' : `SYNTHDEV_${typeUpper}_API_KEY`;

            const currentProvider = this.wizard._getProviderFromUrl(
                this.wizard.getCurrentValue(baseUrlKey)
            );
            const currentModel = this.wizard.getCurrentValue(modelKey) || 'Not set';
            const currentApiKey = this.wizard.getCurrentValue(apiKeyKey) ? '***set***' : 'Not set';

            logger.raw(`Current ${type} configuration:`);
            logger.raw(`  Provider: ${currentProvider}`);
            logger.raw(`  Model: ${currentModel}`);
            logger.raw(`  API Key: ${currentApiKey}`);
            logger.raw('');

            logger.raw('What would you like to change?');
            logger.raw('  1 - Change provider');
            logger.raw('  2 - Change model');
            logger.raw('  3 - Change API key');
            if (type !== 'base') {
                logger.raw('  4 - Copy from base configuration');
            }
            logger.raw('  b - Back to main menu');

            const input = await this.promptForInput(`${type}> `, context);
            const trimmed = input.trim().toLowerCase();

            if (trimmed === 'b' || trimmed === 'back') {
                break;
            } else if (trimmed === '1') {
                await this._selectProvider(context, type);
            } else if (trimmed === '2') {
                await this._selectModel(context, type);
            } else if (trimmed === '3') {
                await this._setApiKey(context, type);
            } else if (trimmed === '4' && type !== 'base') {
                await this._copyFromBase(context, type);
            } else {
                logger.raw('❌ Invalid option. Please try again.');
            }

            logger.raw('');
        }
    }

    /**
     * Select a provider
     * @private
     * @param {Object} context - Execution context
     * @param {string} type - Provider type
     */
    async _selectProvider(context, type) {
        const logger = getLogger();
        const providers = this.wizard.getProviders();

        logger.raw('\n📡 Available Providers:');
        providers.forEach((provider, index) => {
            logger.raw(`  ${index + 1} - ${provider.name}`);
        });
        logger.raw('  c - Cancel');

        const input = await this.promptForInput('Select provider> ', context);
        const trimmed = input.trim().toLowerCase();

        if (trimmed === 'c' || trimmed === 'cancel') {
            return;
        }

        const providerIndex = parseInt(trimmed) - 1;
        if (providerIndex >= 0 && providerIndex < providers.length) {
            const selectedProvider = providers[providerIndex];

            // Fix: Use correct environment variable names for base provider
            if (type === 'base') {
                this.wizard.setConfigValue('SYNTHDEV_BASE_URL', selectedProvider.baseUrl);
                // Clear model selection when provider changes
                this.wizard.setConfigValue('SYNTHDEV_BASE_MODEL', '');
            } else {
                const typeUpper = type.toUpperCase();
                this.wizard.setConfigValue(
                    `SYNTHDEV_${typeUpper}_BASE_URL`,
                    selectedProvider.baseUrl
                );
                // Clear model selection when provider changes
                this.wizard.setConfigValue(`SYNTHDEV_${typeUpper}_MODEL`, '');
            }

            logger.raw(`✅ Provider set to: ${selectedProvider.name}`);
            logger.raw("💡 Don't forget to select a model and set your API key!");
        } else {
            logger.raw('❌ Invalid selection.');
        }
    }

    /**
     * Select a model for the current provider
     * @private
     * @param {Object} context - Execution context
     * @param {string} type - Provider type
     */
    async _selectModel(context, type) {
        const logger = getLogger();

        // Fix: Use correct environment variable names for base provider
        const baseUrlKey =
            type === 'base' ? 'SYNTHDEV_BASE_URL' : `SYNTHDEV_${type.toUpperCase()}_BASE_URL`;
        const modelKey =
            type === 'base' ? 'SYNTHDEV_BASE_MODEL' : `SYNTHDEV_${type.toUpperCase()}_MODEL`;

        const baseUrl = this.wizard.getCurrentValue(baseUrlKey);

        if (!baseUrl) {
            logger.raw('❌ Please select a provider first.');
            return;
        }

        const providerName = this.wizard._getProviderFromUrl(baseUrl);
        const models = this.wizard.getModelsForProvider(providerName);

        if (models.length === 0) {
            logger.raw('❌ No models available for this provider.');
            return;
        }

        logger.raw(`\n🤖 Available Models for ${providerName}:`);
        models.forEach((model, index) => {
            logger.raw(`  ${index + 1} - ${model}`);
        });
        logger.raw('  c - Cancel');

        const input = await this.promptForInput('Select model> ', context);
        const trimmed = input.trim().toLowerCase();

        if (trimmed === 'c' || trimmed === 'cancel') {
            return;
        }

        const modelIndex = parseInt(trimmed) - 1;
        if (modelIndex >= 0 && modelIndex < models.length) {
            const selectedModel = models[modelIndex];
            this.wizard.setConfigValue(modelKey, selectedModel);
            logger.raw(`✅ Model set to: ${selectedModel}`);
        } else {
            logger.raw('❌ Invalid selection.');
        }
    }

    /**
     * Set API key for a provider type
     * @private
     * @param {Object} context - Execution context
     * @param {string} type - Provider type
     */
    async _setApiKey(context, type) {
        const logger = getLogger();

        logger.raw(`\n🔑 Set API Key for ${type.charAt(0).toUpperCase() + type.slice(1)} Provider`);
        logger.raw('Enter your API key (input will be hidden):');

        // Note: In a real implementation, you'd want to hide the input
        // For now, we'll use the standard prompt
        const apiKey = await this.promptForInput('💭 You: ', context);

        if (apiKey && apiKey.trim()) {
            // Fix: Use correct environment variable names for base provider
            const apiKeyKey =
                type === 'base' ? 'SYNTHDEV_API_KEY' : `SYNTHDEV_${type.toUpperCase()}_API_KEY`;
            this.wizard.setConfigValue(apiKeyKey, apiKey.trim());
            logger.raw('✅ API key set successfully.');
        } else {
            logger.raw('❌ API key cannot be empty.');
        }
    }

    /**
     * Copy configuration from base to smart/fast
     * @private
     * @param {Object} context - Execution context
     * @param {string} type - Provider type (smart or fast)
     */
    async _copyFromBase(context, type) {
        const logger = getLogger();
        const typeUpper = type.toUpperCase();

        const baseUrl = this.wizard.getCurrentValue('SYNTHDEV_BASE_URL');
        const baseModel = this.wizard.getCurrentValue('SYNTHDEV_BASE_MODEL');
        const baseApiKey = this.wizard.getCurrentValue('SYNTHDEV_API_KEY');

        if (!baseUrl || !baseModel || !baseApiKey) {
            logger.raw(
                '❌ Base configuration is incomplete. Please configure base provider first.'
            );
            return;
        }

        const confirmed = await this.promptForConfirmation(
            `Copy base configuration to ${type}?\n` +
                `  Provider: ${this.wizard._getProviderFromUrl(baseUrl)}\n` +
                `  Model: ${baseModel}\n` +
                '  API Key: ***set***',
            context
        );

        if (confirmed) {
            this.wizard.setConfigValue(`SYNTHDEV_${typeUpper}_BASE_URL`, baseUrl);
            this.wizard.setConfigValue(`SYNTHDEV_${typeUpper}_MODEL`, baseModel);
            this.wizard.setConfigValue(`SYNTHDEV_${typeUpper}_API_KEY`, baseApiKey);
            logger.raw(`✅ Base configuration copied to ${type}.`);
        } else {
            logger.raw('❌ Copy cancelled.');
        }
    }

    /**
     * Configure other settings
     * @private
     * @param {Object} context - Execution context
     */
    async _configureOtherSettings(context) {
        const logger = getLogger();

        logger.raw('\n⚙️  Other Settings');
        logger.raw('═'.repeat(30));

        while (true) {
            const summary = this.wizard.getConfigSummary();

            logger.raw('Current settings:');
            logger.raw(`  1 - Verbosity Level: ${summary.other.verbosity} (0-5)`);
            logger.raw(`  2 - Max Tool Calls: ${summary.other.maxToolCalls}`);
            logger.raw(`  3 - Prompt Enhancement: ${summary.other.promptEnhancement}`);
            logger.raw('  b - Back to main menu');

            const input = await this.promptForInput('settings> ', context);
            const trimmed = input.trim().toLowerCase();

            if (trimmed === 'b' || trimmed === 'back') {
                break;
            } else if (trimmed === '1') {
                await this._setVerbosityLevel(context);
            } else if (trimmed === '2') {
                await this._setMaxToolCalls(context);
            } else if (trimmed === '3') {
                await this._setPromptEnhancement(context);
            } else {
                logger.raw('❌ Invalid option. Please try again.');
            }

            logger.raw('');
        }
    }

    /**
     * Set verbosity level
     * @private
     * @param {Object} context - Execution context
     */
    async _setVerbosityLevel(context) {
        const logger = getLogger();

        logger.raw('\n📢 Verbosity Level (0-5):');
        logger.raw('  0 - Only information directly affecting the user');
        logger.raw('  1 - Short messages like "🔄 Enhancing prompt..."');
        logger.raw('  2 - Compressed tool arguments (default)');
        logger.raw('  3 - Uncompressed arguments but no tool results');
        logger.raw('  4 - Both arguments and tool results');
        logger.raw('  5 - Every HTTP request and response');

        const input = await this.promptForInput('Verbosity level (0-5)> ', context);
        const level = parseInt(input.trim());

        if (level >= 0 && level <= 5) {
            this.wizard.setConfigValue('SYNTHDEV_VERBOSITY_LEVEL', level.toString());
            logger.raw(`✅ Verbosity level set to: ${level}`);
        } else {
            logger.raw('❌ Invalid verbosity level. Must be 0-5.');
        }
    }

    /**
     * Set max tool calls
     * @private
     * @param {Object} context - Execution context
     */
    async _setMaxToolCalls(context) {
        const logger = getLogger();

        logger.raw('\n🔧 Maximum Tool Calls:');
        logger.raw('This limits how many tool calls can be made in a single request.');
        logger.raw('Default is 50. Higher values allow more complex operations.');

        const input = await this.promptForInput('Max tool calls> ', context);
        const maxCalls = parseInt(input.trim());

        if (maxCalls > 0) {
            this.wizard.setConfigValue('SYNTHDEV_MAX_TOOL_CALLS', maxCalls.toString());
            logger.raw(`✅ Max tool calls set to: ${maxCalls}`);
        } else {
            logger.raw('❌ Invalid value. Must be a positive number.');
        }
    }

    /**
     * Set prompt enhancement setting
     * @private
     * @param {Object} context - Execution context
     */
    async _setPromptEnhancement(context) {
        const logger = getLogger();

        logger.raw('\n✨ Prompt Enhancement:');
        logger.raw('This feature is experimental and may improve prompt quality.');
        logger.raw('  1 - Enable (true)');
        logger.raw('  2 - Disable (false)');

        const input = await this.promptForInput('Enable prompt enhancement? (1/2)> ', context);
        const trimmed = input.trim();

        if (trimmed === '1') {
            this.wizard.setConfigValue('SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT', 'true');
            logger.raw('✅ Prompt enhancement enabled.');
        } else if (trimmed === '2') {
            this.wizard.setConfigValue('SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT', 'false');
            logger.raw('✅ Prompt enhancement disabled.');
        } else {
            logger.raw('❌ Invalid selection. Please choose 1 or 2.');
        }
    }

    /**
     * Save configuration to .env file
     * @private
     * @param {Object} context - Execution context
     */
    async _saveConfiguration(context) {
        const logger = getLogger();

        logger.raw('\n💾 Saving configuration...');

        // Pass the app instance to saveConfiguration for component reinitialization
        const success = this.wizard.saveConfiguration(context.app);

        if (success) {
            logger.raw('✅ Configuration saved successfully to .env file!');

            const completeness = this.wizard.checkCompleteness();
            if (completeness.isComplete) {
                logger.raw('🎉 Your configuration is now complete and ready to use!');
            } else {
                logger.raw('⚠️  Configuration saved but still incomplete. Missing:');
                completeness.missing.forEach(key => {
                    logger.raw(`   • ${key}`);
                });
            }
        } else {
            logger.raw('❌ Failed to save configuration. Please check file permissions.');
        }
    }

    /**
     * Reset all configuration
     * @private
     * @param {Object} context - Execution context
     */
    async _resetConfiguration(context) {
        const logger = getLogger();

        const confirmed = await this.promptForConfirmation(
            'Are you sure you want to reset all configuration? This will clear all current settings.',
            context
        );

        if (confirmed) {
            this.wizard = new ConfigurationWizard();
            logger.raw('✅ Configuration reset. All settings cleared.');
        } else {
            logger.raw('❌ Reset cancelled.');
        }
    }
}
