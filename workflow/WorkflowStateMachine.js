import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getLogger } from '../logger.js';
import WorkflowConfig from './WorkflowConfig.js';
import WorkflowContext from './WorkflowContext.js';
import WorkflowAgent from './WorkflowAgent.js';

/**
 * State machine engine for executing multi-agent workflows
 */
export default class WorkflowStateMachine {
    constructor(config, toolManager, snapshotManager, consoleInterface, costsManager) {
        this.config = config;
        this.toolManager = toolManager;
        this.snapshotManager = snapshotManager;
        this.consoleInterface = consoleInterface;
        this.costsManager = costsManager;
        this.logger = getLogger();

        // Workflow execution state
        this.workflowConfigs = new Map();
        this.contexts = new Map();
        this.agents = new Map();
        this.commonData = {};
        this.subWorkflowResult = null;
        this.lastAgentResponse = null;
        this.lastToolCalls = [];
        this.lastParsingToolCalls = [];

        this.logger.debug('🔄 WorkflowStateMachine initialized');
    }

    /**
     * Load all workflow configurations from the workflows directory
     */
    async loadWorkflowConfigs() {
        try {
            const workflowsPath = join(process.cwd(), 'config', 'workflows');

            if (!existsSync(workflowsPath)) {
                this.logger.debug('📁 No workflows directory found');
                return;
            }

            const workflowFiles = readdirSync(workflowsPath).filter(file => file.endsWith('.json'));

            this.logger.debug(`📁 Found ${workflowFiles.length} workflow files`);

            for (const fileName of workflowFiles) {
                try {
                    const filePath = join(workflowsPath, fileName);
                    const workflowConfig = new WorkflowConfig(filePath);

                    // Load the config to get the workflow name
                    await workflowConfig.load();
                    const workflowName = workflowConfig.getWorkflowName();

                    if (!workflowName) {
                        this.logger.warn(
                            `❌ Workflow file ${fileName} has no workflow_name property`
                        );
                        continue;
                    }

                    // Check for duplicate workflow names
                    if (this.workflowConfigs.has(workflowName)) {
                        this.logger.warn(
                            `❌ Duplicate workflow name '${workflowName}' in file ${fileName}`
                        );
                        continue;
                    }

                    this.workflowConfigs.set(workflowName, workflowConfig);
                    this.logger.debug(`✅ Registered workflow: ${workflowName} (from ${fileName})`);
                } catch (error) {
                    this.logger.warn(
                        `❌ Failed to load workflow from ${fileName}: ${error.message}`
                    );
                }
            }

            this.logger.info(`🔄 Loaded ${this.workflowConfigs.size} workflow configurations`);
        } catch (error) {
            this.logger.error(error, 'Failed to load workflow configurations');
        }
    }

    /**
     * Execute a workflow by name
     * @param {string} workflowName - Name of the workflow to execute
     * @param {string} inputParams - Input parameters for the workflow
     * @returns {Promise<any>} Workflow execution result
     */
    async executeWorkflow(workflowName, inputParams) {
        try {
            const workflowConfig = this.workflowConfigs.get(workflowName);
            if (!workflowConfig) {
                throw new Error(`Unknown workflow: ${workflowName}`);
            }

            // Load the workflow configuration
            const config = await workflowConfig.load();

            this.logger.info(`🔄 Starting workflow: ${workflowName}`);
            this.logger.debug(`📝 Input: ${inputParams}`);

            // Initialize workflow execution context
            const executionContext = await this._initializeWorkflow(config, inputParams);

            // Create workflow snapshot
            await this.snapshotManager.createSnapshot(`Workflow: ${workflowName}`);

            // Execute state machine (currently mocked)
            const result = await this._executeStateMachine(executionContext);

            this.logger.info(`✅ Workflow completed: ${workflowName}`);
            return result;
        } catch (error) {
            this.logger.error(error, `Workflow execution failed: ${workflowName}`);
            throw error;
        }
    }

    /**
     * Initialize workflow execution context
     * @private
     * @param {Object} workflowConfig - Workflow configuration
     * @param {string} inputParams - Input parameters
     * @returns {Promise<Object>} Execution context
     */
    async _initializeWorkflow(workflowConfig, inputParams) {
        // Reset execution state
        this.contexts.clear();
        this.agents.clear();
        this.commonData = {};
        this.subWorkflowResult = null;
        this.lastAgentResponse = null;
        this.lastToolCalls = [];
        this.lastParsingToolCalls = [];

        // Initialize contexts
        for (const contextConfig of workflowConfig.contexts) {
            const context = new WorkflowContext(contextConfig);
            this.contexts.set(contextConfig.name, context);
        }

        // Initialize agents
        for (const agentConfig of workflowConfig.agents) {
            const context = this.contexts.get(agentConfig.context);
            const agent = new WorkflowAgent(
                agentConfig,
                context,
                this.config,
                this.toolManager,
                this.snapshotManager,
                this.costsManager
            );
            this.agents.set(agentConfig.agent_role, agent);
        }

        // Set input parameters
        const inputName = workflowConfig.input.name;
        this.commonData[inputName] = inputParams;

        // Initialize variables
        if (workflowConfig.variables) {
            Object.assign(this.commonData, workflowConfig.variables);
        }

        return {
            config: workflowConfig,
            currentState: 'start',
            states: new Map(workflowConfig.states.map(s => [s.name, s])),
            executionHistory: [],
        };
    }

    /**
     * Execute the state machine
     * @private
     * @param {Object} executionContext - Execution context
     * @returns {Promise<any>} Execution result
     */
    async _executeStateMachine(executionContext) {
        const { config, states } = executionContext;
        let currentStateName = executionContext.currentState;

        this.logger.info('🔄 Starting state machine execution');

        while (currentStateName && currentStateName !== 'stop') {
            const state = states.get(currentStateName);
            if (!state) {
                throw new Error(`Unknown state: ${currentStateName}`);
            }

            this.logger.debug(`🎯 Executing state: ${currentStateName}`);

            // Execute state
            const stateResult = await this._executeState(state, executionContext);
            executionContext.executionHistory.push({
                state: currentStateName,
                result: stateResult,
                timestamp: new Date(),
            });

            // Determine next state
            currentStateName = this._getNextState(state, stateResult, executionContext);
            this.logger.debug(`➡️ Next state: ${currentStateName || 'stop'}`);
        }

        this.logger.info('✅ State machine execution completed');

        // Return workflow output
        const outputName = config.output.name;
        return this.commonData[outputName] || 'Workflow completed successfully';
    }

    /**
     * Get available workflow names
     * @returns {Array<string>} Array of workflow names
     */
    getAvailableWorkflows() {
        return Array.from(this.workflowConfigs.keys());
    }

    /**
     * Get workflow metadata
     * @param {string} workflowName - Workflow name
     * @returns {Object|null} Workflow metadata or null if not found
     */
    async getWorkflowMetadata(workflowName) {
        const workflowConfig = this.workflowConfigs.get(workflowName);
        if (!workflowConfig) {
            return null;
        }

        try {
            await workflowConfig.load();
            return workflowConfig.getMetadata();
        } catch (error) {
            this.logger.error(error, `Failed to get metadata for workflow: ${workflowName}`);
            return null;
        }
    }

    /**
     * Get agent by role
     * @param {string} role - Agent role
     * @returns {WorkflowAgent|null} Agent instance or null if not found
     */
    getAgent(role) {
        return this.agents.get(role) || null;
    }

    /**
     * Get context by name
     * @param {string} name - Context name
     * @returns {WorkflowContext|null} Context instance or null if not found
     */
    getContext(name) {
        return this.contexts.get(name) || null;
    }

    /**
     * Get tool calls from a specific agent's last response
     * @param {string} agentRole - Agent role
     * @returns {Array} Array of tool calls
     */
    getToolCalls(agentRole) {
        const agent = this.getAgent(agentRole);
        return agent ? agent.getToolCalls() : [];
    }

    /**
     * Evaluate an expression in the workflow context
     * @param {string} expression - Expression to evaluate
     * @returns {any} Evaluated result
     */
    evaluateExpression(expression) {
        if (typeof expression === 'string' && expression.startsWith('common_data.')) {
            const path = expression.substring(12); // Remove 'common_data.'
            return this._getNestedProperty(this.commonData, path);
        }
        return expression;
    }

    /**
     * Get nested property from object using dot notation
     * @private
     * @param {Object} obj - Object to traverse
     * @param {string} path - Dot-separated path
     * @returns {any} Property value
     */
    _getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Execute a single state
     * @private
     * @param {Object} state - State configuration
     * @param {Object} executionContext - Execution context
     * @returns {Promise<Object>} State execution result
     */
    async _executeState(state, _executionContext) {
        try {
            // Execute pre-transition script if present
            if (state.action && state.action.script) {
                this._executeScript(state.action.script);
            }

            // Execute agent action if present
            if (state.agent) {
                const agent = this.agents.get(state.agent);
                if (!agent) {
                    throw new Error(`Unknown agent: ${state.agent}`);
                }

                // Evaluate input expression
                const input = this._evaluateExpression(state.input);
                this.logger.debug(`📝 Evaluated input for agent ${state.agent}: "${input}"`);

                // Execute agent function
                const functionName = state.action?.function || 'sendUserMessage';
                let result;

                this.logger.debug(
                    `🤖 Agent ${state.agent} executing: ${functionName} with input: "${input}"`
                );

                if (functionName === 'sendUserMessage') {
                    result = await agent.sendMessage(input);
                } else if (functionName === 'addUserMessage') {
                    result = await agent.addUserMessage(input);
                } else if (functionName === 'clearConversation') {
                    result = await agent.clearConversation();
                } else {
                    throw new Error(`Unknown agent function: ${functionName}`);
                }

                this.logger.debug(
                    `✅ Agent ${state.agent} completed ${functionName}, result: "${result}"`
                );

                // Update last response tracking
                this.lastAgentResponse = result;
                this.lastToolCalls = agent.getToolCalls();
                this.lastParsingToolCalls = agent.getParsingToolCalls();

                this.logger.debug(
                    `📊 Agent ${state.agent} tool calls: ${this.lastToolCalls.length}, parsing tool calls: ${this.lastParsingToolCalls.length}`
                );

                return {
                    success: true,
                    result: result,
                    agent: state.agent,
                    toolCalls: this.lastToolCalls,
                    parsingToolCalls: this.lastParsingToolCalls,
                };
            }

            return { success: true };
        } catch (error) {
            this.logger.error(error, `State execution failed: ${state.name}`);
            throw error;
        }
    }

    /**
     * Determine the next state based on transitions
     * @private
     * @param {Object} state - Current state
     * @param {Object} stateResult - Result from state execution
     * @param {Object} executionContext - Execution context
     * @returns {string|null} Next state name or null to stop
     */
    _getNextState(state, stateResult, _executionContext) {
        if (!state.transition || !Array.isArray(state.transition)) {
            return 'stop'; // No transitions defined, stop execution
        }

        for (const transition of state.transition) {
            // Execute before script if present
            if (transition.before) {
                this._executeScript(transition.before);
            }

            // Evaluate transition condition
            if (this._evaluateCondition(transition.condition, stateResult)) {
                return transition.target;
            }
        }

        return 'stop'; // Default to stop if no transitions match
    }

    /**
     * Evaluate a condition expression
     * @private
     * @param {string} condition - Condition expression
     * @param {Object} context - Execution context
     * @returns {boolean} Condition result
     */
    _evaluateCondition(condition, context = {}) {
        // Simple condition evaluation
        if (condition === 'true') {
            return true;
        }
        if (condition === 'false') {
            return false;
        }

        try {
            // Handle function call access pattern
            if (condition.includes('function.')) {
                return this._evaluateFunctionCondition(condition);
            }

            // Create a safe evaluation context with workflow methods
            const evaluationContext = {
                getToolCalls: agentRole => this.getToolCalls(agentRole),
                getAgent: role => this.getAgent(role),
                getContext: name => this.getContext(name),
                common_data: this.commonData,
                agents: this.agents,
                contexts: this.contexts,
            };

            // Evaluate JavaScript expressions in safe context
            const func = new Function('this', 'context', `return ${condition}`);
            return func.call(evaluationContext, context);
        } catch (error) {
            this.logger.warn(`Condition evaluation failed: ${condition}`, error);
            return false;
        }
    }

    /**
     * Evaluate function call conditions (e.g., function.review_work.arguments.improvement_needed === true)
     * @private
     * @param {string} condition - Function condition expression
     * @returns {boolean} Condition result
     */
    _evaluateFunctionCondition(condition) {
        // Parse function.{tool_name}.arguments.{argument_name} pattern
        const functionMatch = condition.match(/function\.(\w+)\.arguments\.(\w+)/);
        if (!functionMatch) {
            throw new Error(`Invalid function condition format: ${condition}`);
        }

        const [, toolName, argumentName] = functionMatch;

        // Find the parsing tool call
        const toolCall = this.lastParsingToolCalls.find(call => call.function.name === toolName);
        if (!toolCall) {
            return false; // Tool call not found
        }

        // Get the argument value
        const argumentValue = toolCall.function.arguments[argumentName];

        // Replace the function access with the actual value and evaluate
        const evaluableCondition = condition.replace(
            `function.${toolName}.arguments.${argumentName}`,
            JSON.stringify(argumentValue)
        );

        try {
            const func = new Function(`return ${evaluableCondition}`);
            return func();
        } catch (error) {
            this.logger.warn(`Function condition evaluation failed: ${condition}`, error);
            return false;
        }
    }

    /**
     * Execute a JavaScript script
     * @private
     * @param {string} script - Script to execute
     * @returns {any} Script result
     */
    _executeScript(script) {
        try {
            // Handle function call access in scripts
            let processedScript = script;
            if (script.includes('function.')) {
                processedScript = this._processFunctionCallsInScript(script);
            }

            // Create a function that has access to the workflow context
            const func = new Function('common_data', 'agents', 'contexts', processedScript);
            return func.call(this, this.commonData, this.agents, this.contexts);
        } catch (error) {
            this.logger.error(error, `Script execution failed: ${script}`);
            throw error;
        }
    }

    /**
     * Process function call access in scripts
     * @private
     * @param {string} script - Script with function calls
     * @returns {string} Processed script
     */
    _processFunctionCallsInScript(script) {
        // Replace function.{tool_name}.arguments.{argument_name} with actual values
        return script.replace(
            /function\.(\w+)\.arguments\.(\w+)/g,
            (_match, toolName, argumentName) => {
                const toolCall = this.lastParsingToolCalls.find(
                    call => call.function.name === toolName
                );
                if (toolCall && toolCall.function.arguments[argumentName] !== undefined) {
                    return JSON.stringify(toolCall.function.arguments[argumentName]);
                }
                return 'undefined';
            }
        );
    }

    /**
     * Evaluate an expression with enhanced context access
     * @private
     * @param {string} expression - Expression to evaluate
     * @returns {any} Evaluated result
     */
    _evaluateExpression(expression) {
        if (typeof expression !== 'string') {
            return expression;
        }

        // Simple property access
        if (expression.startsWith('common_data.') && !expression.includes(' ')) {
            const path = expression.substring(12); // Remove 'common_data.'
            return this._getNestedProperty(this.commonData, path);
        }

        // Complex expression that needs JavaScript evaluation
        if (expression.includes('common_data.')) {
            try {
                // Create a function with the context variables in scope
                const func = new Function(
                    'common_data',
                    'agents',
                    'contexts',
                    `return ${expression}`
                );

                const result = func.call(this, this.commonData, this.agents, this.contexts);
                this.logger.debug(`📊 Expression "${expression}" evaluated to: "${result}"`);
                return result;
            } catch (error) {
                this.logger.error(error, `Expression evaluation failed: ${expression}`);
                throw new Error(`Failed to evaluate expression: ${expression} - ${error.message}`);
            }
        }

        // Return as-is if no special handling needed
        return expression;
    }

    /**
     * Get workflow execution statistics
     * @returns {Object} Execution statistics
     */
    getStats() {
        return {
            loadedWorkflows: this.workflowConfigs.size,
            activeContexts: this.contexts.size,
            activeAgents: this.agents.size,
            commonDataKeys: Object.keys(this.commonData).length,
        };
    }
}
