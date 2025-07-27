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

- **running**: Agent is actively processing tasks and can receive messages
- **inactive**: Agent finished its response without sending `return_results`
- **completed**: Agent has finished its primary task by calling `return_results` but can still receive follow-up messages
- **failed**: Agent encountered an error and cannot process further messages

## Usage

The agent system is integrated into the existing role system. Roles with an `enabled_agents` property can spawn and manage other agents using the agent management tools.

See the functional specification documents for detailed implementation requirements and usage examples.
