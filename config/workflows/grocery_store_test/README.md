# Grocery Store Test Workflow

## Overview

The **grocery_store_test** workflow simulates a customer-grocery worker interaction to test multi-agent conversation patterns and context sharing. This workflow demonstrates how two agents can engage in a natural conversation with proper role mapping and decision-making capabilities.

## Purpose

- **Testing multi-agent conversations**: Validates that agents can maintain coherent dialogue
- **Context sharing validation**: Ensures conversation history is properly maintained across agent interactions
- **Decision-making patterns**: Tests how agents can make decisions to continue or terminate conversations
- **Role-based messaging**: Demonstrates proper role mapping between workflow agents and conversation context

## How It Works

### Workflow States

1. **start** (grocery_worker)

    - Adds initial customer request to conversation context
    - Grocery worker responds to customer's initial request
    - Always transitions to customer_decision

2. **customer_decision** (customer)

    - Customer decides whether to continue shopping or conclude
    - Uses `interaction_decision` tool to make structured decisions
    - Processes customer's choice and updates context accordingly

3. **worker_response** (grocery_worker)

    - Worker responds to customer's continued requests
    - Adds response to conversation context
    - Returns to customer_decision for next interaction

4. **stop**
    - Workflow terminates with interaction summary

### Agent Roles

#### grocery_worker

- **Role**: assistant
- **System Message**: "You are a helpful grocery store worker. You assist customers with finding products, answering questions about items, providing recommendations, and helping with their shopping needs. Be friendly, knowledgeable, and efficient."
- **Level**: fast
- **Tools**: Standard conversation tools (no special parsing tools)
- **Responsibilities**:
    - Respond helpfully to customer requests
    - Provide product information and recommendations
    - Maintain friendly, professional demeanor

#### customer

- **Role**: user
- **System Message**: "You are a customer shopping at a grocery store. You have specific needs and questions about products. You can ask for help finding items, get recommendations, ask about prices, ingredients, or any other shopping-related questions. Be realistic in your requests and decide when you're satisfied with the help received."
- **Level**: fast
- **Special Tools**:
    - `interaction_decision`: Structured decision tool to continue or conclude shopping
- **Responsibilities**:
    - Make realistic shopping requests
    - Decide when to continue or conclude the interaction
    - Provide shopping summary when finished

## Input/Output

### Input

- **Name**: `initial_customer_request`
- **Type**: string
- **Description**: What the customer initially asks for or mentions when approaching the grocery worker
- **Example**: "Hi, I'm looking for organic vegetables and need help finding the best options for a salad."

### Output

- **Name**: `interaction_summary`
- **Type**: string
- **Description**: Summary of the customer-worker interaction and what was accomplished
- **Example**: "Customer successfully found organic lettuce, tomatoes, and cucumbers for their salad. Worker provided recommendations for dressing and helped locate all items in produce section."

## Configuration Variables

- **max_interactions**: 15 (maximum number of conversation turns)
- **Context**: `store_conversation` with 30,000 character limit

## Key Features

### Structured Decision Making

The customer agent uses the `interaction_decision` tool with structured parameters:

```json
{
  "continue_shopping": boolean,
  "continue_message": "string (required if continuing)",
  "shopping_summary": "string (required if concluding)"
}
```

### Context Management

- Single shared context (`store_conversation`) maintains conversation history
- Proper role mapping: customer messages as 'user', worker messages as 'assistant'
- Automatic message addition after each agent response

### Circular Conversation Pattern

The workflow supports natural back-and-forth conversation:

- Worker responds → Customer decides → Worker responds → Customer decides...
- Continues until customer chooses to conclude or max interactions reached

## Usage Example

```javascript
// Example workflow execution
const input = {
    initial_customer_request: 'I need help finding ingredients for a birthday cake',
};

// Workflow will simulate:
// 1. Worker greets and offers help with cake ingredients
// 2. Customer asks specific questions about flour types, decorations
// 3. Worker provides recommendations and locations
// 4. Customer decides if they need more help or are satisfied
// 5. Process repeats until customer concludes with summary
```

## Testing Applications

This workflow is ideal for testing:

- **Agent conversation flow**: Ensuring natural dialogue patterns
- **Context persistence**: Verifying conversation history is maintained
- **Decision logic**: Testing structured decision-making tools
- **Role consistency**: Validating agents maintain their assigned roles
- **Termination conditions**: Ensuring workflows conclude appropriately
