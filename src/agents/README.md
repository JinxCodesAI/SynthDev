# Agent System

This directory contains the core components for the Agentic Collaboration System.

## Components

### AgentManager.js

Singleton class that orchestrates all agent processes. Responsibilities:

- Managing agent lifecycle (creation, tracking, termination)
- Enforcing permissions based on `enabled_agents` configuration
- Routing messages between agents
- Monitoring agent processes for failures

### AgentProcess.js

Represents a single, isolated agent instance. Features:

- Own AIAPIClient instance with separate conversation history
- Role-based model selection and system message configuration
- Status management (running, inactive, completed, failed)
- Parent-child relationship tracking

## Agent Statuses

- **running**: Agent is actively processing tasks and should NOT be disturbed with new messages
- **inactive**: Agent finished its response without sending `return_results`, CAN receive messages
- **completed**: Agent called `return_results` to finish its task, CAN receive messages for clarifications
- **failed**: Agent encountered an error and CANNOT process messages

### Message Sending Rules

- **running** agents: Cannot receive messages (will throw error)
- **inactive** agents: Can receive messages to continue work
- **completed** agents: Can receive messages for corrections or follow-up tasks
- **failed** agents: Cannot receive messages (will throw error)

## Usage

The agent system is integrated into the existing role system. Roles with an `enabled_agents` property can spawn and manage other agents using the agent management tools.

See the functional specification documents for detailed implementation requirements and usage examples.
