import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getLogger } from '../core/managers/logger.js';
import WorkflowConfig from './WorkflowConfig.js';
import WorkflowContext from './WorkflowContext.js';
import WorkflowAgent from './WorkflowAgent.js';

/**
 * State machine engine for executing multi-agent workflows
 */
export default class WorkflowStateMachine {
    constructor(config, toolManager, consoleInterface, costsManager) {
        this.config = config;
        this.toolManager = toolManager;
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
        this.lastRawResponse = null; // Store raw API response for script access
        this.lastToolCalls = [];
        this.lastParsingToolCalls = [];

        // Script execution context - this object will be bound to script functions
        this.scriptContext = {
            common_data: this.commonData,
            last_response: null,
            workflow_contexts: this.contexts,
            input: null,
        };

        this.logger.debug('🔄 WorkflowStateMachine initialized');
    }

    /**
     * Load all workflow configurations from the workflows directory
     */
    async loadWorkflowConfigs() {
        try {
            const workflowsPath = join(process.cwd(), 'src', 'config', 'workflows');

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
     * Load a single workflow configuration
     * @param {string} configPath - Path to the workflow configuration file
     * @returns {Promise<Object>} Loaded workflow configuration
     */
    async loadWorkflow(configPath) {
        try {
            const workflowConfig = new WorkflowConfig(configPath);
            const config = await workflowConfig.load();
            const workflowName = workflowConfig.getWorkflowName();

            if (!workflowName) {
                throw new Error('Workflow configuration has no workflow_name property');
            }

            this.workflowConfigs.set(workflowName, workflowConfig);
            this.logger.debug(`✅ Loaded workflow: ${workflowName}`);

            return config;
        } catch (error) {
            this.logger.error(error, `Failed to load workflow from ${configPath}`);
            throw error;
        }
    }

    /**
     * Execute a workflow by name
     * @param {string} workflowName - Name of the workflow to execute
     * @param {string} inputParams - Input parameters for the workflow
     * @returns {Promise<any>} Workflow execution result
     */
    async executeWorkflow(workflowName, inputParams) {
        const startTime = Date.now();
        try {
            const workflowConfig = this.workflowConfigs.get(workflowName);
            if (!workflowConfig) {
                throw new Error(`Workflow not found: ${workflowName}`);
            }

            // Load the workflow configuration
            const config = await workflowConfig.load();

            this.logger.info(`🔄 Starting workflow: ${workflowName}`);
            this.logger.debug(`📝 Input: ${inputParams}`);

            // Initialize workflow execution context
            const executionContext = await this._initializeWorkflow(config, inputParams);

            // Snapshot functionality removed

            // Execute state machine
            const result = await this._executeStateMachine(executionContext);
            const executionTime = Date.now() - startTime;

            this.logger.info(`✅ Workflow completed: ${workflowName}`);

            return {
                success: true,
                workflow_name: workflowName,
                final_state: executionContext.currentState || 'stop',
                execution_time: executionTime,
                states_visited: executionContext.executionHistory.map(h => h.state),
                output: result,
                common_data: { ...this.commonData },
            };
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.logger.error(error, `Workflow execution failed: ${workflowName}`);

            return {
                success: false,
                workflow_name: workflowName,
                error: error.message,
                execution_time: executionTime,
                states_visited: [],
            };
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
        this.lastRawResponse = null;

        // Update script context references
        this.scriptContext.common_data = this.commonData;
        this.scriptContext.workflow_contexts = this.contexts;
        this.scriptContext.input = inputParams;

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
            executionContext.currentState = currentStateName; // Update current state
            this.logger.debug(`➡️ Next state: ${currentStateName || 'stop'}`);
        }

        this.logger.info('✅ State machine execution completed');

        // Return workflow output
        // First check if there's a stop state with an input field
        const stopState = states.get('stop');
        if (stopState && stopState.input) {
            // Evaluate the stop state's input expression
            const stopOutput = this.evaluateExpression(stopState.input);
            this.logger.debug(`Output from stop state: ${stopOutput}`);
            if (stopOutput !== undefined && stopOutput !== null) {
                return stopOutput;
            }
        }

        // Fallback to the workflow's output configuration
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
     * Execute a single state using the new 4-step pattern
     * @private
     * @param {Object} state - State configuration
     * @param {Object} executionContext - Execution context
     * @returns {Promise<Object>} State execution result
     */
    async _executeState(state, executionContext) {
        try {
            this.logger.debug(`🎯 Executing state: ${state.name}`);

            // Get the workflow config to access script module
            const workflowConfig = this.workflowConfigs.get(executionContext.config.workflow_name);

            // Skip agent execution for stop state
            if (state.name === 'stop') {
                return { success: true, nextState: null };
            }

            // Validate that state has an agent
            if (!state.agent) {
                throw new Error(`State ${state.name} must have an agent defined`);
            }

            const agentRole = state.agent;
            const agent = this.agents.get(agentRole);
            if (!agent) {
                throw new Error(`Unknown agent: ${agentRole}`);
            }

            // STEP 1: Execute pre-handler (agent modifies context before API call)
            if (state.pre_handler) {
                this.logger.debug(`🔧 Executing pre-handler: ${state.pre_handler}`);
                this._executeScriptFunction(state.pre_handler, workflowConfig);
            }

            // STEP 2: Agent executes API call to update last_response
            this.logger.debug(`🔍 DEBUG: About to call agent.makeContextCall() for ${agentRole}`);
            const result = await agent.makeContextCall(); // Use context-based API call
            this.logger.debug(`🔍 DEBUG: agent.makeContextCall() completed for ${agentRole}`);

            // Update last response tracking
            this.lastAgentResponse = result;
            this.lastRawResponse = agent.getLastRawResponse();
            this.lastToolCalls = agent.getToolCalls();
            this.lastParsingToolCalls = agent.getParsingToolCalls();

            console.log(
                `🔍 DEBUG: State ${state.name} - agent.getLastRawResponse():`,
                JSON.stringify(this.lastRawResponse, null, 2)
            );
            console.log(
                `🔍 DEBUG: State ${state.name} - agent.getToolCalls():`,
                JSON.stringify(this.lastToolCalls, null, 2)
            );
            console.log(
                `🔍 DEBUG: State ${state.name} - agent.getParsingToolCalls():`,
                JSON.stringify(this.lastParsingToolCalls, null, 2)
            );

            this.logger.debug(
                `🔍 DEBUG: agent.getLastRawResponse() returned: ${this.lastRawResponse ? 'OBJECT' : 'NULL'}`
            );
            this.logger.debug(
                `🔍 DEBUG: agent.getToolCalls() returned: ${this.lastToolCalls.length} calls`
            );
            this.logger.debug(
                `🔍 DEBUG: agent.getParsingToolCalls() returned: ${this.lastParsingToolCalls.length} calls`
            );

            this.logger.debug(`✅ Agent ${agentRole} completed API call, result: "${result}"`);
            this.logger.debug(
                `📊 Agent ${agentRole} tool calls: ${this.lastToolCalls.length}, parsing tool calls: ${this.lastParsingToolCalls.length}`
            );

            // Debug: Log the raw response to verify it's being captured
            this.logger.debug(`🔍 Raw response captured: ${this.lastRawResponse ? 'YES' : 'NO'}`);
            if (this.lastRawResponse) {
                this.logger.debug(
                    `🔍 Raw response tool calls: ${this.lastRawResponse.choices?.[0]?.message?.tool_calls?.length || 0}`
                );
            }

            // STEP 3: Execute post-handler (agent modifies context using last_response)
            if (state.post_handler) {
                this.logger.debug(`🔧 Executing post-handler: ${state.post_handler}`);
                // Update script context right before executing script function
                this._updateScriptContext();
                this._executeScriptFunction(state.post_handler, workflowConfig);
            }

            // STEP 4: Execute transition-handler (agent decides next state)
            let nextState = null;
            if (state.transition_handler) {
                this.logger.debug(`🔧 Executing transition-handler: ${state.transition_handler}`);
                // Update script context right before executing script function
                this._updateScriptContext();
                nextState = this._executeScriptFunction(state.transition_handler, workflowConfig);
            }

            return {
                success: true,
                result: result,
                agent: agentRole,
                toolCalls: this.lastToolCalls,
                parsingToolCalls: this.lastParsingToolCalls,
                nextState: nextState,
            };
        } catch (error) {
            this.logger.error(error, `State execution failed: ${state.name}`);
            throw error;
        }
    }

    /**
     * Determine the next state using the new pattern
     * @private
     * @param {Object} state - Current state
     * @param {Object} stateResult - Result from state execution
     * @param {Object} executionContext - Execution context
     * @returns {string|null} Next state name or null to stop
     */
    _getNextState(state, stateResult, executionContext) {
        // In the new pattern, the next state is determined by the transition_handler
        // which was already executed in _executeState and returned in stateResult.nextState
        if (stateResult.nextState) {
            this.logger.debug(`➡️ Next state: ${stateResult.nextState}`);
            return stateResult.nextState;
        }

        // Default to stop if no next state specified
        this.logger.debug('➡️ Next state: stop (default)');
        return 'stop';
    }

    /**
     * Evaluate a condition expression
     * @private
     * @param {string} condition - Condition expression
     * @param {Object} context - Execution context
     * @param {Object} workflowConfig - Workflow configuration (optional, for script module access)
     * @returns {boolean} Condition result
     */
    _evaluateCondition(condition, context = {}, workflowConfig = null) {
        // Simple condition evaluation
        if (condition === 'true') {
            return true;
        }
        if (condition === 'false') {
            return false;
        }

        try {
            this.logger.debug(`🔍 Evaluating condition: ${condition}`);

            // Check if this is a function reference
            if (this._isScriptFunctionReference(condition) && workflowConfig) {
                const result = this._executeScriptFunction(condition, workflowConfig);
                this.logger.debug(`✅ Condition "${condition}" evaluated to: ${result}`);
                return result;
            }

            // Handle function call access pattern
            if (condition.includes('function.')) {
                const result = this._evaluateFunctionCondition(condition);
                this.logger.debug(`✅ Function condition "${condition}" evaluated to: ${result}`);
                return result;
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
            const result = func.call(evaluationContext, context);
            this.logger.debug(`✅ Expression condition "${condition}" evaluated to: ${result}`);
            return result;
        } catch (error) {
            this.logger.error(
                error,
                `⚠️ ${error.constructor.name}: ${error.message}: Condition evaluation failed: ${condition}`
            );
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
     * Execute a JavaScript script or function reference
     * @private
     * @param {string} script - Script to execute or function name to call
     * @param {Object} workflowConfig - Workflow configuration (optional, for script module access)
     * @returns {any} Script result
     */
    _executeScript(script, workflowConfig = null) {
        try {
            // Check if this is a function reference (no spaces, no operators, no semicolons)
            if (this._isScriptFunctionReference(script) && workflowConfig) {
                return this._executeScriptFunction(script, workflowConfig);
            }

            // Handle inline script execution (legacy support)
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
     * Check if a script string is a function reference
     * @private
     * @param {string} script - Script string to check
     * @returns {boolean} True if it's a function reference
     */
    _isScriptFunctionReference(script) {
        // Function references should be simple identifiers without spaces, operators, or semicolons
        return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(script.trim());
    }

    /**
     * Execute a script function from the loaded module
     * @private
     * @param {string} functionName - Name of the function to execute
     * @param {Object} workflowConfig - Workflow configuration with script module
     * @returns {any} Function result
     */
    _executeScriptFunction(functionName, workflowConfig) {
        const scriptModule = workflowConfig.getScriptModule();
        if (!scriptModule) {
            throw new Error(`No script module loaded for function: ${functionName}`);
        }

        const func = scriptModule[functionName];
        if (typeof func !== 'function') {
            throw new Error(`Function not found in script module: ${functionName}`);
        }

        // Update script context with latest data and script module functions before execution
        this._updateScriptContextWithModule(workflowConfig);

        this.logger.debug(`🔧 Executing script function: ${functionName}`);

        // Bind and execute the function
        const result = func.call(this.scriptContext);

        this.logger.debug(`✅ Script function ${functionName} returned: ${JSON.stringify(result)}`);

        return result;
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
     * Evaluate template string with variable substitution
     * @param {string} template - Template string with {{variable}} placeholders
     * @returns {string} Evaluated string
     */
    _evaluateTemplateString(template) {
        if (typeof template !== 'string') {
            return template;
        }

        return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
            const value = this._evaluateExpression(expression.trim());
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * Update the script context with latest workflow state
     * @private
     */
    _updateScriptContext() {
        this.scriptContext.common_data = this.commonData;
        this.scriptContext.last_response = this.lastRawResponse; // Use raw response for script access
        this.scriptContext.workflow_contexts = this.contexts;

        // Debug logging
        this.logger.debug(
            `🔍 Script context updated - last_response: ${this.lastRawResponse ? 'SET' : 'NULL'}`
        );
        if (this.lastRawResponse) {
            const toolCalls = this.lastRawResponse.choices?.[0]?.message?.tool_calls;
            this.logger.debug(
                `🔍 Script context - tool calls in last_response: ${toolCalls?.length || 0}`
            );
        }
    }

    /**
     * Update the script context with latest workflow state and script module functions
     * @private
     * @param {Object} workflowConfig - Workflow configuration with script module
     */
    _updateScriptContextWithModule(workflowConfig) {
        this._updateScriptContext();

        // Add script module functions to the context so they can call each other
        const scriptModule = workflowConfig.getScriptModule();
        if (scriptModule) {
            // Add all script functions to the context
            Object.keys(scriptModule).forEach(functionName => {
                if (typeof scriptModule[functionName] === 'function') {
                    this.scriptContext[functionName] = scriptModule[functionName].bind(
                        this.scriptContext
                    );
                }
            });
        }
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
