#!/usr/bin/env node

import { join } from 'path';
import WorkflowStateMachine from './src/workflow/WorkflowStateMachine.js';
import ConfigManager from './src/config/managers/configManager.js';
import ToolManager from './src/core/managers/toolManager.js';
import ConsoleInterface from './src/core/interface/consoleInterface.js';
import costsManager from './src/core/managers/costsManager.js';
import { groceryStoreHttpMocks } from './tests/mocks/grocery-store-http.js';

// Mock OpenAI
const mockCreate = groceryStoreHttpMocks.createOpenAIMock();
const mockOpenAI = {
    chat: {
        completions: {
            create: mockCreate,
        },
    },
    baseURL: 'https://api.openai.com/v1',
};

// We'll need to handle the mocking differently in the real test environment

// Set environment variables
process.env.MODEL = 'gpt-4.1-nano';
process.env.MAX_COMPLETION_TOKENS = '32000';
process.env.SYNTHDEV_API_KEY = 'sk-test-key';
process.env.SYNTHDEV_BASE_URL = 'https://api.openai.com/v1';
process.env.SYNTHDEV_VERBOSITY_LEVEL = '4';

async function debugWorkflow() {
    try {
        console.log('🔍 Starting workflow debug...');

        const confMgr = ConfigManager.getInstance();
        await confMgr.initialize();

        const toolManager = new ToolManager();
        const consoleInterface = new ConsoleInterface();

        const stateMachine = new WorkflowStateMachine(
            confMgr,
            toolManager,
            consoleInterface,
            costsManager
        );

        // Load workflow
        const workflowConfigPath = join(
            process.cwd(),
            'src',
            'config',
            'workflows',
            'grocery_store_test.json'
        );
        await stateMachine.loadWorkflow(workflowConfigPath);

        console.log('🔍 Executing workflow...');
        const result = await stateMachine.executeWorkflow(
            'grocery_store_test',
            "Hi, I'm looking for ingredients to make pasta dinner for 6 people tomorrow. Do you have good marinara sauce?"
        );

        console.log('🔍 Workflow result:', JSON.stringify(result, null, 2));
        console.log('🔍 States visited:', result.states_visited);
        console.log('🔍 Mock calls:', mockCreate.mock?.calls?.length || 'No mock calls');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugWorkflow();
