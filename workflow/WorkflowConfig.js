import { existsSync, readFileSync } from 'fs';
import { getLogger } from '../logger.js';

/**
 * Workflow configuration parser and validator
 */
export default class WorkflowConfig {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = null;
        this.workflowName = null; // Will be set from the JSON file
        this.logger = getLogger();
    }

    /**
     * Load and parse workflow configuration
     * @returns {Promise<Object>} Parsed workflow configuration
     */
    async load() {
        try {
            if (!existsSync(this.configPath)) {
                throw new Error(`Workflow configuration not found: ${this.configPath}`);
            }

            const configContent = readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configContent);

            // Set the workflow name from the config
            this.workflowName = this.config.workflow_name;

            // Validate the configuration
            this._validateConfig();

            this.logger.debug(`✅ Loaded workflow config: ${this.workflowName}`);
            return this.config;
        } catch (error) {
            this.logger.error(error, `Failed to load workflow config: ${this.workflowName}`);
            throw error;
        }
    }

    /**
     * Get the loaded configuration
     * @returns {Object|null} Workflow configuration or null if not loaded
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get the workflow name from the configuration
     * @returns {string|null} Workflow name or null if not loaded
     */
    getWorkflowName() {
        return this.workflowName;
    }

    /**
     * Validate workflow configuration structure
     * @private
     */
    _validateConfig() {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        // Required fields
        const requiredFields = [
            'workflow_name',
            'description',
            'input',
            'output',
            'contexts',
            'agents',
            'states',
        ];

        for (const field of requiredFields) {
            if (!this.config[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate input/output definitions
        this._validateParameterDefinition(this.config.input, 'input');
        this._validateParameterDefinition(this.config.output, 'output');

        // Validate contexts
        this._validateContexts();

        // Validate agents
        this._validateAgents();

        // Validate states
        this._validateStates();

        this.logger.debug(`✅ Workflow config validation passed: ${this.workflowName}`);
    }

    /**
     * Validate parameter definition (input/output)
     * @private
     * @param {Object} param - Parameter definition
     * @param {string} type - Parameter type (input/output)
     */
    _validateParameterDefinition(param, type) {
        if (!param.name || typeof param.name !== 'string') {
            throw new Error(`${type} parameter must have a valid name`);
        }
        if (!param.type || typeof param.type !== 'string') {
            throw new Error(`${type} parameter must have a valid type`);
        }
        if (!param.description || typeof param.description !== 'string') {
            throw new Error(`${type} parameter must have a description`);
        }
    }

    /**
     * Validate contexts configuration
     * @private
     */
    _validateContexts() {
        if (!Array.isArray(this.config.contexts) || this.config.contexts.length === 0) {
            throw new Error('At least one context must be defined');
        }

        const contextNames = new Set();
        for (const context of this.config.contexts) {
            if (!context.name || typeof context.name !== 'string') {
                throw new Error('Context must have a valid name');
            }
            if (contextNames.has(context.name)) {
                throw new Error(`Duplicate context name: ${context.name}`);
            }
            contextNames.add(context.name);

            // Optional fields validation
            if (context.starting_messages && !Array.isArray(context.starting_messages)) {
                throw new Error(`Context ${context.name}: starting_messages must be an array`);
            }
            if (
                context.max_length &&
                (typeof context.max_length !== 'number' || context.max_length <= 0)
            ) {
                throw new Error(`Context ${context.name}: max_length must be a positive number`);
            }
        }
    }

    /**
     * Validate agents configuration
     * @private
     */
    _validateAgents() {
        if (!Array.isArray(this.config.agents) || this.config.agents.length === 0) {
            throw new Error('At least one agent must be defined');
        }

        const contextNames = new Set(this.config.contexts.map(c => c.name));
        const agentRoles = new Set();

        for (const agent of this.config.agents) {
            if (!agent.agent_role || typeof agent.agent_role !== 'string') {
                throw new Error('Agent must have a valid agent_role');
            }
            if (agentRoles.has(agent.agent_role)) {
                throw new Error(`Duplicate agent role: ${agent.agent_role}`);
            }
            agentRoles.add(agent.agent_role);

            if (!agent.context || typeof agent.context !== 'string') {
                throw new Error(`Agent ${agent.agent_role}: must have a valid context`);
            }
            if (!contextNames.has(agent.context)) {
                throw new Error(
                    `Agent ${agent.agent_role}: references unknown context ${agent.context}`
                );
            }

            if (!agent.role || !['user', 'assistant'].includes(agent.role)) {
                throw new Error(`Agent ${agent.agent_role}: role must be 'user' or 'assistant'`);
            }
        }
    }

    /**
     * Validate states configuration
     * @private
     */
    _validateStates() {
        if (!Array.isArray(this.config.states) || this.config.states.length === 0) {
            throw new Error('At least one state must be defined');
        }

        const stateNames = new Set();
        const agentRoles = new Set(this.config.agents.map(a => a.agent_role));
        let hasStartState = false;

        for (const state of this.config.states) {
            if (!state.name || typeof state.name !== 'string') {
                throw new Error('State must have a valid name');
            }
            if (stateNames.has(state.name)) {
                throw new Error(`Duplicate state name: ${state.name}`);
            }
            stateNames.add(state.name);

            if (state.name === 'start') {
                hasStartState = true;
            }

            // Validate agent reference
            if (state.agent && !agentRoles.has(state.agent)) {
                throw new Error(`State ${state.name}: references unknown agent ${state.agent}`);
            }

            // Validate action
            if (state.action) {
                this._validateAction(state.action, state.name);
            }

            // Validate transitions
            if (state.transition && Array.isArray(state.transition)) {
                for (const transition of state.transition) {
                    this._validateTransition(transition, state.name);
                }
            }
        }

        if (!hasStartState) {
            throw new Error('Workflow must have a "start" state');
        }
    }

    /**
     * Validate action configuration
     * @private
     * @param {Object} action - Action configuration
     * @param {string} stateName - State name for error reporting
     */
    _validateAction(action, stateName) {
        if (action.function && typeof action.function !== 'string') {
            throw new Error(`State ${stateName}: action.function must be a string`);
        }
        if (action.script && typeof action.script !== 'string') {
            throw new Error(`State ${stateName}: action.script must be a string`);
        }
        if (action.sub_workflow && typeof action.sub_workflow !== 'string') {
            throw new Error(`State ${stateName}: action.sub_workflow must be a string`);
        }
    }

    /**
     * Validate transition configuration
     * @private
     * @param {Object} transition - Transition configuration
     * @param {string} stateName - State name for error reporting
     */
    _validateTransition(transition, stateName) {
        if (!transition.target || typeof transition.target !== 'string') {
            throw new Error(`State ${stateName}: transition must have a valid target`);
        }
        if (!transition.condition || typeof transition.condition !== 'string') {
            throw new Error(`State ${stateName}: transition must have a valid condition`);
        }
        if (transition.before && typeof transition.before !== 'string') {
            throw new Error(`State ${stateName}: transition.before must be a string`);
        }
    }

    /**
     * Get workflow metadata
     * @returns {Object} Workflow metadata
     */
    getMetadata() {
        if (!this.config) {
            return null;
        }

        return {
            name: this.config.workflow_name,
            description: this.config.description,
            input: this.config.input,
            output: this.config.output,
            contextCount: this.config.contexts.length,
            agentCount: this.config.agents.length,
            stateCount: this.config.states.length,
        };
    }
}
