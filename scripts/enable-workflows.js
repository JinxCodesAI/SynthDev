#!/usr/bin/env node

/**
 * Script to easily enable workflow functionality
 *
 * This script:
 * 1. Updates the configuration to enable workflows
 * 2. Uncomments workflow-related code in core files
 * 3. Re-registers workflow commands
 *
 * Usage: node scripts/enable-workflows.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = 'config/defaults/application.json';
const APP_JS_PATH = 'app.js';
const COMMAND_HANDLER_PATH = 'commandHandler.js';
const COMMAND_REGISTRY_SETUP_PATH = 'commands/base/CommandRegistrySetup.js';

function enableWorkflows() {
    console.log('🔄 Enabling workflow functionality...\n');

    try {
        // 1. Update configuration
        console.log('📝 Updating configuration...');
        const configContent = readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configContent);
        config.features.enableWorkflows = true;
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
        console.log('✅ Configuration updated\n');

        // 2. Uncomment workflow imports in app.js
        console.log('📝 Updating app.js...');
        let appContent = readFileSync(APP_JS_PATH, 'utf8');
        appContent = appContent.replace(
            "// import WorkflowStateMachine from './workflow/WorkflowStateMachine.js'; // Hidden in workflow-tool",
            "import WorkflowStateMachine from './workflow/WorkflowStateMachine.js';"
        );
        appContent = appContent.replace(
            /\/\/ this\.workflowStateMachine = new WorkflowStateMachine\( \/\/ Hidden in workflow-tool\n.*?\/\/ \);/gs,
            `this.workflowStateMachine = new WorkflowStateMachine(
            this.config,
            this.toolManager,
            this.snapshotManager,
            this.consoleInterface,
            this.costsManager
        );`
        );
        appContent = appContent.replace(
            '// await this.workflowStateMachine.loadWorkflowConfigs();',
            'await this.workflowStateMachine.loadWorkflowConfigs();'
        );
        writeFileSync(APP_JS_PATH, appContent);
        console.log('✅ app.js updated\n');

        // 3. Uncomment workflow state machine in commandHandler.js
        console.log('📝 Updating commandHandler.js...');
        let commandHandlerContent = readFileSync(COMMAND_HANDLER_PATH, 'utf8');
        commandHandlerContent = commandHandlerContent.replace(
            '// workflowStateMachine: this.app?.workflowStateMachine, // Hidden in workflow-tool',
            'workflowStateMachine: this.app?.workflowStateMachine,'
        );
        writeFileSync(COMMAND_HANDLER_PATH, commandHandlerContent);
        console.log('✅ commandHandler.js updated\n');

        // 4. Uncomment workflow commands in CommandRegistrySetup.js
        console.log('📝 Updating CommandRegistrySetup.js...');
        let registryContent = readFileSync(COMMAND_REGISTRY_SETUP_PATH, 'utf8');
        registryContent = registryContent.replace(
            "// import WorkflowsCommand from '../workflow/WorkflowsCommand.js'; // Hidden in workflow-tool",
            "import WorkflowsCommand from '../workflow/WorkflowsCommand.js';"
        );
        registryContent = registryContent.replace(
            "// import WorkflowCommand from '../workflow/WorkflowCommand.js'; // Hidden in workflow-tool",
            "import WorkflowCommand from '../workflow/WorkflowCommand.js';"
        );
        registryContent = registryContent.replace(
            '// registry.register(new WorkflowsCommand());',
            'registry.register(new WorkflowsCommand());'
        );
        registryContent = registryContent.replace(
            '// registry.register(new WorkflowCommand());',
            'registry.register(new WorkflowCommand());'
        );
        writeFileSync(COMMAND_REGISTRY_SETUP_PATH, registryContent);
        console.log('✅ CommandRegistrySetup.js updated\n');

        console.log('🎉 Workflow functionality has been enabled!');
        console.log('');
        console.log('📋 What was changed:');
        console.log('   ✅ Configuration: features.enableWorkflows = true');
        console.log('   ✅ Workflow imports and initialization restored');
        console.log('   ✅ Workflow commands re-registered');
        console.log('');
        console.log('🔄 Please restart the application to apply changes');
        console.log('');
        console.log('💡 Available commands after restart:');
        console.log('   - /workflows - List available workflows');
        console.log('   - /workflow <name> - Execute a workflow');
    } catch (error) {
        console.error('❌ Error enabling workflows:', error.message);
        process.exit(1);
    }
}

function disableWorkflows() {
    console.log('🔄 Disabling workflow functionality...\n');

    try {
        // 1. Update configuration
        console.log('📝 Updating configuration...');
        const configContent = readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configContent);
        config.features.enableWorkflows = false;
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
        console.log('✅ Configuration updated\n');

        // 2. Comment workflow imports in app.js
        console.log('📝 Updating app.js...');
        let appContent = readFileSync(APP_JS_PATH, 'utf8');
        appContent = appContent.replace(
            "import WorkflowStateMachine from './workflow/WorkflowStateMachine.js';",
            "// import WorkflowStateMachine from './workflow/WorkflowStateMachine.js'; // Hidden in workflow-tool"
        );
        appContent = appContent.replace(
            /this\.workflowStateMachine = new WorkflowStateMachine\(\s*this\.config,\s*this\.toolManager,\s*this\.snapshotManager,\s*this\.consoleInterface,\s*this\.costsManager\s*\);/gs,
            `// this.workflowStateMachine = new WorkflowStateMachine( // Hidden in workflow-tool
        //     this.config,
        //     this.toolManager,
        //     this.snapshotManager,
        //     this.consoleInterface,
        //     this.costsManager
        // );`
        );
        appContent = appContent.replace(
            'await this.workflowStateMachine.loadWorkflowConfigs();',
            '// await this.workflowStateMachine.loadWorkflowConfigs();'
        );
        writeFileSync(APP_JS_PATH, appContent);
        console.log('✅ app.js updated\n');

        // 3. Comment workflow state machine in commandHandler.js
        console.log('📝 Updating commandHandler.js...');
        let commandHandlerContent = readFileSync(COMMAND_HANDLER_PATH, 'utf8');
        commandHandlerContent = commandHandlerContent.replace(
            'workflowStateMachine: this.app?.workflowStateMachine,',
            '// workflowStateMachine: this.app?.workflowStateMachine, // Hidden in workflow-tool'
        );
        writeFileSync(COMMAND_HANDLER_PATH, commandHandlerContent);
        console.log('✅ commandHandler.js updated\n');

        // 4. Comment workflow commands in CommandRegistrySetup.js
        console.log('📝 Updating CommandRegistrySetup.js...');
        let registryContent = readFileSync(COMMAND_REGISTRY_SETUP_PATH, 'utf8');
        registryContent = registryContent.replace(
            "import WorkflowsCommand from '../workflow/WorkflowsCommand.js';",
            "// import WorkflowsCommand from '../workflow/WorkflowsCommand.js'; // Hidden in workflow-tool"
        );
        registryContent = registryContent.replace(
            "import WorkflowCommand from '../workflow/WorkflowCommand.js';",
            "// import WorkflowCommand from '../workflow/WorkflowCommand.js'; // Hidden in workflow-tool"
        );
        registryContent = registryContent.replace(
            'registry.register(new WorkflowsCommand());',
            '// registry.register(new WorkflowsCommand());'
        );
        registryContent = registryContent.replace(
            'registry.register(new WorkflowCommand());',
            '// registry.register(new WorkflowCommand());'
        );
        writeFileSync(COMMAND_REGISTRY_SETUP_PATH, registryContent);
        console.log('✅ CommandRegistrySetup.js updated\n');

        console.log('🎉 Workflow functionality has been disabled!');
        console.log('');
        console.log('📋 What was changed:');
        console.log('   ✅ Configuration: features.enableWorkflows = false');
        console.log('   ✅ Workflow imports and initialization commented out');
        console.log('   ✅ Workflow commands unregistered');
        console.log('');
        console.log('🔄 Please restart the application to apply changes');
        console.log('');
        console.log('💡 Workflow functionality is still available through the workflow_tool');
    } catch (error) {
        console.error('❌ Error disabling workflows:', error.message);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const action = args[0];

if (action === 'enable') {
    enableWorkflows();
} else if (action === 'disable') {
    disableWorkflows();
} else {
    console.log('Usage: node scripts/enable-workflows.js [enable|disable]');
    console.log('');
    console.log('Actions:');
    console.log('  enable  - Enable workflow functionality');
    console.log('  disable - Disable workflow functionality');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/enable-workflows.js enable');
    console.log('  node scripts/enable-workflows.js disable');
}
