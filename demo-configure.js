#!/usr/bin/env node

/**
 * Demo script to show the configuration wizard functionality
 * This script demonstrates the new /configure command and auto-configuration features
 */

import { ConfigurationWizard } from './utils/ConfigurationWizard.js';
import { EnvFileManager } from './utils/EnvFileManager.js';
import ConfigManager from './configManager.js';

console.log('🔧 Synth-Dev Configuration System Demo');
console.log('═'.repeat(50));

async function demonstrateConfigurationSystem() {
    try {
        // 1. Show current configuration status
        console.log('\n📊 Current Configuration Status:');
        console.log('─'.repeat(30));

        const configManager = ConfigManager.getInstance();
        const status = configManager.isConfigurationComplete();

        console.log(`✅ Environment file exists: ${status.envFileExists}`);
        console.log(`✅ Configuration complete: ${status.isComplete}`);
        console.log(`✅ Minimally complete: ${status.isMinimallyComplete}`);

        if (status.missing.length > 0) {
            console.log(`❌ Missing fields: ${status.missing.join(', ')}`);
        }

        if (status.incomplete.length > 0) {
            console.log(`⚠️  Incomplete fields: ${status.incomplete.join(', ')}`);
        }

        // 2. Show environment file manager capabilities
        console.log('\n📁 Environment File Manager:');
        console.log('─'.repeat(30));

        const envManager = new EnvFileManager();
        console.log(`📄 .env file path: ${envManager.getEnvFilePath()}`);
        console.log(`📄 Example file path: ${envManager.getExampleEnvFilePath()}`);
        console.log(`✅ .env exists: ${envManager.envFileExists()}`);

        if (envManager.envFileExists()) {
            const currentEnv = envManager.readEnvFile();
            console.log(`🔧 Current variables: ${Object.keys(currentEnv).length} found`);

            // Show some key variables (without exposing sensitive data)
            const keyVars = [
                'SYNTHDEV_BASE_MODEL',
                'SYNTHDEV_BASE_URL',
                'SYNTHDEV_VERBOSITY_LEVEL',
            ];
            keyVars.forEach(key => {
                if (currentEnv[key]) {
                    const value = key === 'SYNTHDEV_API_KEY' ? '[HIDDEN]' : currentEnv[key];
                    console.log(`   ${key}: ${value}`);
                }
            });
        }

        // 3. Show providers configuration
        console.log('\n🌐 Available Providers:');
        console.log('─'.repeat(30));

        const wizard = new ConfigurationWizard();
        const providers = wizard._loadProviders();

        providers.providers.forEach((provider, index) => {
            console.log(`${index + 1}. ${provider.name}`);
            console.log(`   📡 Base URL: ${provider.baseUrl}`);
            console.log(`   🤖 Models: ${provider.models.length} available`);
            console.log(
                `   📝 Examples: ${provider.models.slice(0, 3).join(', ')}${provider.models.length > 3 ? '...' : ''}`
            );
            console.log('');
        });

        // 4. Show configuration wizard features
        console.log('🧙 Configuration Wizard Features:');
        console.log('─'.repeat(30));
        console.log('✅ Base model configuration (required)');
        console.log('✅ Smart model configuration (optional)');
        console.log('✅ Fast model configuration (optional)');
        console.log('✅ Interactive provider selection');
        console.log('✅ Model selection with pagination');
        console.log('✅ API key validation');
        console.log('✅ Global settings configuration');
        console.log('✅ Prompt enhancement setting');
        console.log('✅ Automatic .env file creation/update');
        console.log('✅ Auto-start when configuration incomplete');
        console.log('✅ Available via /configure command');

        // 5. Show command integration
        console.log('\n⌨️  Command Integration:');
        console.log('─'.repeat(30));
        console.log('• /configure           - Start configuration wizard');
        console.log('• /configure force     - Force reconfiguration');
        console.log('• /configure help      - Show detailed help');
        console.log('• Auto-start wizard    - When .env missing or incomplete');

        // 6. Show comprehensive configuration options
        console.log('\n🔧 Comprehensive Configuration Options:');
        console.log('─'.repeat(40));
        console.log('📋 Base Model (Required):');
        console.log('   • SYNTHDEV_API_KEY');
        console.log('   • SYNTHDEV_BASE_MODEL');
        console.log('   • SYNTHDEV_BASE_URL');
        console.log('');
        console.log('🧠 Smart Model (Optional):');
        console.log('   • SYNTHDEV_SMART_API_KEY');
        console.log('   • SYNTHDEV_SMART_MODEL');
        console.log('   • SYNTHDEV_SMART_BASE_URL');
        console.log('');
        console.log('⚡ Fast Model (Optional):');
        console.log('   • SYNTHDEV_FAST_API_KEY');
        console.log('   • SYNTHDEV_FAST_MODEL');
        console.log('   • SYNTHDEV_FAST_BASE_URL');
        console.log('');
        console.log('⚙️  Global Settings:');
        console.log('   • SYNTHDEV_VERBOSITY_LEVEL (0-5)');
        console.log('   • SYNTHDEV_MAX_TOOL_CALLS');
        console.log('   • SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT');

        // 7. Show auto-configuration trigger conditions
        console.log('\n🚀 Auto-Configuration Triggers:');
        console.log('─'.repeat(30));
        console.log('• Missing .env file');
        console.log('• Missing SYNTHDEV_API_KEY');
        console.log('• Missing SYNTHDEV_BASE_URL');
        console.log('• Missing SYNTHDEV_BASE_MODEL');
        console.log('• Default/placeholder values detected');

        console.log('\n✨ Demo completed successfully!');
        console.log('🎯 To test the wizard, run: node app.js (without a valid .env file)');
        console.log('🎯 Or use the /configure command within Synth-Dev');
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error('📋 Stack trace:', error.stack);
    }
}

// Run the demonstration
demonstrateConfigurationSystem().catch(console.error);
