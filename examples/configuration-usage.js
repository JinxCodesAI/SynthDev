/**
 * Configuration System Usage Examples
 * Demonstrates how to use the new configurable system
 */

import SystemMessages from '../systemMessages.js';
import { getUIConfigManager } from '../uiConfigManager.js';
import { getToolConfigManager } from '../toolConfigManager.js';
import { getConfigurationLoader } from '../configurationLoader.js';

// Example 1: Using configurable system messages
console.log('=== System Messages Example ===');

// Get system message for coder role (loads from config/roles/roles.json)
const coderMessage = SystemMessages.getSystemMessage('coder');
console.log('Coder system message:', `${coderMessage.substring(0, 100)}...`);

// Get excluded tools for architect role
const architectTools = SystemMessages.getExcludedTools('architect');
console.log('Architect excluded tools:', architectTools);

// Get all available roles
const availableRoles = SystemMessages.getAvailableRoles();
console.log('Available roles:', availableRoles);

// Example 2: Using UI configuration manager
console.log('\n=== UI Configuration Example ===');

const uiConfig = getUIConfigManager();

// Get startup message with parameters
const startupTitle = uiConfig.getMessage('startup.title');
console.log('Startup title:', startupTitle);

// Get formatted message with parameters
const modelInfo = uiConfig.getMessage('startup.model_info', { model: 'gpt-4.1-mini' });
console.log('Model info:', modelInfo);

// Get command help
const helpCommand = uiConfig.getCommandHelp('help');
console.log('Help command description:', helpCommand);

// Example 3: Using tool configuration manager
console.log('\n=== Tool Configuration Example ===');

const toolConfig = getToolConfigManager();

// Get safety prompt for script validation
const script = 'console.log("Hello World");';
const safetyPrompt = toolConfig.getSafetyPrompt(script);
console.log('Safety prompt length:', safetyPrompt.length);

// Get dangerous patterns
const dangerousPatterns = toolConfig.getDangerousPatterns();
console.log('Number of dangerous patterns:', dangerousPatterns.length);

// Get error message with parameters
const errorMsg = toolConfig.getErrorMessage('file_not_found', { path: '/test/file.js' });
console.log('Error message:', errorMsg);

// Get tool description
const toolDesc = toolConfig.getToolDescription('read_file');
console.log('Read file description:', toolDesc);

// Example 4: Direct configuration loading
console.log('\n=== Direct Configuration Loading Example ===');

const configLoader = getConfigurationLoader();

// Try to load a custom configuration (will throw if not found)
try {
    const customConfig = configLoader.loadConfig('custom/my-config.json');
    console.log('Custom config:', customConfig);
} catch (error) {
    console.log('Custom config not found (expected):', error.message);
}

// Check if configuration file exists
const rolesExist = configLoader.configExists('roles/roles.json');
console.log('Roles config exists:', rolesExist);

// Example 5: Configuration reloading
console.log('\n=== Configuration Reloading Example ===');

// Reload all role configurations (useful for development)
SystemMessages.reloadRoles();
console.log('Roles reloaded');

// Reload UI configurations
uiConfig.reloadConfigs();
console.log('UI configs reloaded');

// Reload tool configurations
toolConfig.reloadConfigs();
console.log('Tool configs reloaded');

// Example 6: Error handling and fallbacks
console.log('\n=== Error Handling Example ===');

try {
    // Try to get a non-existent role
    const _invalidRole = SystemMessages.getSystemMessage('nonexistent');
} catch (error) {
    console.log('Expected error for invalid role:', error.message);
}

// Get message with missing key (returns fallback)
const missingMessage = uiConfig.getMessage('nonexistent.key');
console.log('Missing message fallback:', missingMessage);

// Example 7: Configuration loading demonstration
console.log('\n=== Configuration Loading Example ===');

// Load roles configuration (required file)
const rolesConfig = configLoader.loadConfig('roles/roles.json', {}, true);
console.log('Loaded roles:', Object.keys(rolesConfig));

// Load environment template
const envTemplate = configLoader.loadConfig('roles/environment-template.json', {}, true);
console.log('Environment template loaded:', !!envTemplate.template);

console.log('\n=== Configuration System Ready ===');
console.log('All configuration managers are working correctly!');
console.log('Configuration files are loaded from:', configLoader.getConfigDir());
