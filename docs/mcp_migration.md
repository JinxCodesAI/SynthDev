# MCP Migration Implementation Plan

## Overview

This document outlines the detailed implementation plan for migrating Synth-Dev's current tool system to the Model Context Protocol (MCP) architecture. The migration will encapsulate existing tools as an MCP server and implement an MCP client to use them, enabling future integration with other MCP servers.

## Current Architecture Analysis

### Existing Components

- **ToolManager**: Loads and executes tools from `tools/` directory
- **Tools**: 10 tools (calculate, edit_file, exact_search, execute_script, execute_terminal, explain_codebase, get_time, list_directory, read_file, write_file)
- **Tool Structure**: Each tool has `definition.json` and `implementation.js`
- **Base Classes**: `BaseTool`, `FileBaseTool`, `CommandBaseTool` for standardized tool development
- **AIAPIClient**: Handles OpenAI-compatible API communication with tool calling
- **CommandHandler**: Manages console commands using modular command registry

### Current Tool Flow

1. ToolManager loads tools from filesystem
2. Tools are registered with AIAPIClient
3. AI makes tool calls via OpenAI function calling format
4. ToolManager executes tools and returns results
5. Results are displayed via ConsoleInterface

## MCP Architecture Target

### MCP Components

- **MCP Server**: Exposes current tools as MCP tools
- **MCP Client**: Connects to MCP servers and translates to current tool interface
- **Transport Layer**: JSON-RPC communication (stdio and HTTP)
- **Protocol Compliance**: Full MCP specification adherence

## Implementation Plan

### Phase 1: MCP Server Implementation (Week 1-2)

#### 1.1 Create MCP Server Infrastructure

**Files to create:**

- `mcp/server/McpServer.js` - Main MCP server implementation
- `mcp/server/McpToolAdapter.js` - Adapts existing tools to MCP format
- `mcp/server/McpTransport.js` - Transport layer abstraction
- `mcp/server/stdio/StdioTransport.js` - Stdio transport implementation
- `mcp/server/http/HttpTransport.js` - HTTP transport implementation

**Key Features:**

- JSON-RPC 2.0 message handling
- Capability negotiation
- Tool discovery and execution
- Error handling and logging
- Session management

#### 1.2 Tool Adaptation Layer

**Purpose:** Convert existing tool definitions to MCP format without changing tool implementations

**Implementation:**

```javascript
// McpToolAdapter.js
class McpToolAdapter {
    constructor(toolManager) {
        this.toolManager = toolManager;
        this.mcpTools = new Map();
        this._adaptExistingTools();
    }

    _adaptExistingTools() {
        // Convert tool definitions to MCP format
        // Map existing tool schema to MCP tool schema
        // Preserve all existing functionality
    }
}
```

#### 1.3 MCP Server Core

**Features:**

- Tool listing (`tools/list`)
- Tool calling (`tools/call`)
- Capability advertisement
- Protocol version negotiation
- Error standardization

### Phase 2: MCP Client Implementation (Week 2-3)

#### 2.1 Create MCP Client Infrastructure

**Files to create:**

- `mcp/client/McpClient.js` - Main MCP client implementation
- `mcp/client/McpClientManager.js` - Manages multiple MCP server connections
- `mcp/client/McpToolProxy.js` - Proxies MCP tools to existing tool interface
- `mcp/client/transports/` - Client transport implementations

#### 2.2 Integration with Existing System

**Strategy:** Replace ToolManager with McpClientManager while maintaining identical interface

**Implementation:**

```javascript
// McpClientManager.js
class McpClientManager {
    constructor() {
        this.clients = new Map(); // server_id -> McpClient
        this.tools = []; // Aggregated tools from all servers
        this.toolImplementations = new Map();
    }

    // Maintain ToolManager interface
    async loadTools() {
        /* Load from MCP servers */
    }
    getTools() {
        /* Return aggregated tools */
    }
    async executeToolCall(toolCall, consoleInterface, snapshotManager) {
        // Route to appropriate MCP server
    }
}
```

### Phase 3: Configuration and Discovery (Week 3-4)

#### 3.1 MCP Server Configuration

**Files to create:**

- `config/mcp/servers.json` - MCP server configurations
- `config/mcp/client.json` - MCP client settings

**Configuration Format:**

```json
{
    "servers": {
        "synth-dev-tools": {
            "type": "stdio",
            "command": "node",
            "args": ["mcp/server/main.js"],
            "description": "Synth-Dev built-in tools"
        },
        "external-server": {
            "type": "http",
            "url": "http://localhost:3001/mcp",
            "description": "External MCP server"
        }
    },
    "client": {
        "timeout": 30000,
        "retries": 3,
        "discovery": {
            "enabled": true,
            "sources": ["config", "environment"]
        }
    }
}
```

#### 3.2 Server Discovery System

**Features:**

- Automatic server discovery
- Health checking
- Capability caching
- Connection management
- Fallback mechanisms

### Phase 4: Backward Compatibility Layer (Week 4)

#### 4.1 Dual Mode Operation

**Strategy:** Support both direct tool execution and MCP-based execution

**Implementation:**

- Feature flag: `USE_MCP_TOOLS` (default: false initially)
- Gradual migration path
- Performance comparison
- Rollback capability

#### 4.2 Tool Interface Preservation

**Ensure:**

- Existing tool calling patterns work unchanged
- AIAPIClient integration remains identical
- ConsoleInterface displays work the same
- Error handling maintains current behavior

### Phase 5: Enhanced MCP Features (Week 5-6)

#### 5.1 Resource Support

**Add MCP Resources for:**

- Configuration files (`config://`)
- Project files (`file://`)
- Documentation (`docs://`)
- Logs (`logs://`)

#### 5.2 Prompt Templates

**Create MCP Prompts for:**

- Role-based interactions
- Common workflows
- Tool usage patterns
- Error recovery

#### 5.3 Sampling Support

**Enable:**

- Server-initiated AI interactions
- Recursive tool calling
- Multi-step workflows
- Agent-to-agent communication

### Phase 6: Testing and Validation (Week 6-7)

#### 6.1 Comprehensive Testing

**Test Coverage:**

- Unit tests for MCP components
- Integration tests for tool execution
- End-to-end workflow tests
- Performance benchmarks
- Error scenario testing

#### 6.2 Validation Framework

**Create:**

- MCP protocol compliance tests
- Tool behavior validation
- Performance regression tests
- Memory usage monitoring
- Connection stability tests

## Technical Implementation Details

### MCP Server Architecture

```javascript
// mcp/server/main.js - Entry point
import { McpServer } from './McpServer.js';
import { StdioTransport } from './stdio/StdioTransport.js';
import { createToolAdapter } from './McpToolAdapter.js';

async function main() {
    const server = new McpServer({
        name: 'synth-dev-tools',
        version: '1.0.0',
    });

    const toolAdapter = await createToolAdapter();
    server.setToolAdapter(toolAdapter);

    const transport = new StdioTransport();
    await server.connect(transport);
}

main().catch(console.error);
```

### MCP Client Integration

```javascript
// Integration point in app.js
import { McpClientManager } from './mcp/client/McpClientManager.js';

// Replace ToolManager initialization
const toolManager = new McpClientManager();
await toolManager.initialize();

// Rest of the application remains unchanged
```

### Tool Adaptation Strategy

**Preserve Existing Tools:**

- No changes to tool implementations
- Maintain existing `definition.json` format
- Keep all tool features and behaviors
- Preserve error handling patterns

**MCP Mapping:**

```javascript
// Convert existing tool definition to MCP format
function adaptToolDefinition(toolDef) {
    return {
        name: toolDef.name,
        description: toolDef.description,
        inputSchema: {
            type: 'object',
            properties: toolDef.schema.function.parameters.properties,
            required: toolDef.schema.function.parameters.required,
        },
    };
}
```

## Configuration Management

### MCP Server Configuration

**Location:** `config/mcp/`
**Files:**

- `servers.json` - Server definitions
- `client.json` - Client settings
- `capabilities.json` - Feature flags

### Environment Variables

```bash
# MCP Configuration
MCP_ENABLED=true
MCP_SERVER_PORT=3001
MCP_CLIENT_TIMEOUT=30000
MCP_LOG_LEVEL=info
```

## Migration Strategy

### Phase-by-Phase Rollout

1. **Development Phase:** MCP alongside existing system
2. **Testing Phase:** Parallel execution and validation
3. **Gradual Migration:** Feature flag controlled rollout
4. **Full Migration:** MCP as primary system
5. **Cleanup Phase:** Remove legacy code

### Risk Mitigation

- **Rollback Plan:** Instant fallback to existing system
- **Performance Monitoring:** Continuous performance comparison
- **Error Tracking:** Enhanced error reporting during migration
- **User Communication:** Clear migration status and benefits

## Benefits of MCP Migration

### Immediate Benefits

- **Standardization:** Industry-standard protocol compliance
- **Interoperability:** Connect to any MCP-compatible server
- **Modularity:** Better separation of concerns
- **Extensibility:** Easy addition of new tool sources

### Future Opportunities

- **Third-party Tools:** Integration with external MCP servers
- **Tool Marketplace:** Access to community-developed tools
- **Multi-agent Workflows:** Enhanced agent-to-agent communication
- **Resource Sharing:** Standardized context and data sharing

### Performance Considerations

- **Overhead:** Minimal JSON-RPC protocol overhead
- **Caching:** Tool definition and capability caching
- **Connection Pooling:** Efficient server connection management
- **Lazy Loading:** On-demand tool discovery and loading

## Success Metrics

### Technical Metrics

- **Tool Execution Time:** < 5% performance degradation
- **Memory Usage:** < 10% increase in memory footprint
- **Error Rate:** Maintain current error rates
- **Test Coverage:** > 90% coverage for MCP components

### Functional Metrics

- **Feature Parity:** 100% existing functionality preserved
- **New Capabilities:** Successful integration with external MCP servers
- **User Experience:** No degradation in user experience
- **Reliability:** Improved error handling and recovery

## Timeline Summary

| Phase | Duration | Key Deliverables            |
| ----- | -------- | --------------------------- |
| 1     | Week 1-2 | MCP Server Implementation   |
| 2     | Week 2-3 | MCP Client Implementation   |
| 3     | Week 3-4 | Configuration and Discovery |
| 4     | Week 4   | Backward Compatibility      |
| 5     | Week 5-6 | Enhanced MCP Features       |
| 6     | Week 6-7 | Testing and Validation      |

**Total Duration:** 7 weeks
**Milestone Reviews:** End of each phase
**Go/No-Go Decision Points:** After Phase 2 and Phase 4

This migration plan ensures a smooth transition to MCP while preserving all existing functionality and opening up new possibilities for tool integration and multi-agent workflows.

## Detailed Implementation Specifications

### MCP Server Implementation

#### Core Server Class

```javascript
// mcp/server/McpServer.js
import { EventEmitter } from 'events';
import { getLogger } from '../../logger.js';

export class McpServer extends EventEmitter {
    constructor(info) {
        super();
        this.info = info;
        this.capabilities = {
            tools: {},
            resources: {},
            prompts: {},
            logging: {},
        };
        this.tools = new Map();
        this.transport = null;
        this.logger = getLogger();
    }

    async connect(transport) {
        this.transport = transport;
        transport.onMessage = this.handleMessage.bind(this);
        transport.onClose = this.handleClose.bind(this);
        await transport.start();
        this.logger.info(`MCP Server ${this.info.name} connected`);
    }

    async handleMessage(message) {
        try {
            const response = await this.processRequest(message);
            if (response) {
                await this.transport.send(response);
            }
        } catch (error) {
            await this.sendError(message.id, error);
        }
    }

    async processRequest(request) {
        switch (request.method) {
            case 'initialize':
                return this.handleInitialize(request);
            case 'tools/list':
                return this.handleToolsList(request);
            case 'tools/call':
                return this.handleToolCall(request);
            default:
                throw new Error(`Unknown method: ${request.method}`);
        }
    }

    handleInitialize(request) {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: '2025-03-26',
                capabilities: this.capabilities,
                serverInfo: this.info,
            },
        };
    }

    async handleToolsList(request) {
        const tools = Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }));

        return {
            jsonrpc: '2.0',
            id: request.id,
            result: { tools },
        };
    }

    async handleToolCall(request) {
        const { name, arguments: args } = request.params;
        const tool = this.tools.get(name);

        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        const result = await tool.execute(args);

        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result),
                    },
                ],
            },
        };
    }

    registerTool(name, tool) {
        this.tools.set(name, tool);
        this.capabilities.tools = {}; // Indicate tool support
    }

    async sendError(id, error) {
        const errorResponse = {
            jsonrpc: '2.0',
            id,
            error: {
                code: -32603,
                message: error.message,
                data: error.stack,
            },
        };
        await this.transport.send(errorResponse);
    }
}
```

#### Tool Adapter Implementation

```javascript
// mcp/server/McpToolAdapter.js
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class McpToolAdapter {
    constructor() {
        this.adaptedTools = new Map();
    }

    async loadExistingTools() {
        const toolsDir = join(__dirname, '../../tools');
        const toolDirs = readdirSync(toolsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name !== 'common')
            .map(dirent => dirent.name);

        for (const toolDir of toolDirs) {
            await this.adaptTool(toolsDir, toolDir);
        }
    }

    async adaptTool(toolsDir, toolName) {
        const toolPath = join(toolsDir, toolName);
        const definitionPath = join(toolPath, 'definition.json');
        const implementationPath = join(toolPath, 'implementation.js');

        // Load existing tool definition
        const definition = JSON.parse(readFileSync(definitionPath, 'utf8'));

        // Import existing implementation
        const implementation = await import(`file://${implementationPath}`);

        // Create MCP-compatible tool
        const mcpTool = {
            name: definition.name,
            description: definition.description,
            inputSchema: this.convertSchema(definition.schema.function.parameters),
            execute: implementation.default,
        };

        this.adaptedTools.set(definition.name, mcpTool);
    }

    convertSchema(openAISchema) {
        // Convert OpenAI function schema to MCP input schema
        return {
            type: 'object',
            properties: openAISchema.properties,
            required: openAISchema.required || [],
        };
    }

    getAdaptedTools() {
        return this.adaptedTools;
    }
}
```

#### Stdio Transport Implementation

```javascript
// mcp/server/stdio/StdioTransport.js
import { EventEmitter } from 'events';

export class StdioTransport extends EventEmitter {
    constructor() {
        super();
        this.onMessage = null;
        this.onClose = null;
    }

    async start() {
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', this.handleInput.bind(this));
        process.stdin.on('end', this.handleClose.bind(this));
        process.on('SIGINT', this.handleClose.bind(this));
        process.on('SIGTERM', this.handleClose.bind(this));
    }

    handleInput(data) {
        const lines = data.trim().split('\n');
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);
                    if (this.onMessage) {
                        this.onMessage(message);
                    }
                } catch (error) {
                    console.error('Invalid JSON:', error.message);
                }
            }
        }
    }

    async send(message) {
        const json = JSON.stringify(message);
        process.stdout.write(json + '\n');
    }

    handleClose() {
        if (this.onClose) {
            this.onClose();
        }
        process.exit(0);
    }
}
```

### MCP Client Implementation

#### Core Client Class

```javascript
// mcp/client/McpClient.js
import { EventEmitter } from 'events';
import { getLogger } from '../../logger.js';

export class McpClient extends EventEmitter {
    constructor(clientInfo) {
        super();
        this.clientInfo = clientInfo;
        this.serverInfo = null;
        this.capabilities = null;
        this.transport = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.logger = getLogger();
    }

    async connect(transport) {
        this.transport = transport;
        transport.onMessage = this.handleMessage.bind(this);
        transport.onClose = this.handleClose.bind(this);

        await transport.connect();
        await this.initialize();
    }

    async initialize() {
        const response = await this.sendRequest('initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {
                sampling: {},
            },
            clientInfo: this.clientInfo,
        });

        this.serverInfo = response.result.serverInfo;
        this.capabilities = response.result.capabilities;

        this.logger.info(`Connected to MCP server: ${this.serverInfo.name}`);
    }

    async sendRequest(method, params = {}) {
        const id = ++this.requestId;
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.transport.send(request);
        });
    }

    handleMessage(message) {
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);

            if (message.error) {
                reject(new Error(message.error.message));
            } else {
                resolve(message);
            }
        }
    }

    async listTools() {
        const response = await this.sendRequest('tools/list');
        return response.result.tools;
    }

    async callTool(name, args) {
        const response = await this.sendRequest('tools/call', {
            name,
            arguments: args,
        });
        return response.result;
    }

    handleClose() {
        this.emit('close');
    }
}
```

#### Client Manager Implementation

```javascript
// mcp/client/McpClientManager.js
import { McpClient } from './McpClient.js';
import { StdioClientTransport } from './stdio/StdioClientTransport.js';
import { HttpClientTransport } from './http/HttpClientTransport.js';
import { getLogger } from '../../logger.js';

export class McpClientManager {
    constructor() {
        this.clients = new Map();
        this.tools = [];
        this.toolImplementations = new Map();
        this.logger = getLogger();
    }

    async initialize() {
        const config = await this.loadConfiguration();

        for (const [serverId, serverConfig] of Object.entries(config.servers)) {
            await this.connectToServer(serverId, serverConfig);
        }

        await this.aggregateTools();
    }

    async connectToServer(serverId, config) {
        try {
            const client = new McpClient({
                name: 'synth-dev',
                version: '1.0.0',
            });

            let transport;
            if (config.type === 'stdio') {
                transport = new StdioClientTransport(config);
            } else if (config.type === 'http') {
                transport = new HttpClientTransport(config);
            } else {
                throw new Error(`Unknown transport type: ${config.type}`);
            }

            await client.connect(transport);
            this.clients.set(serverId, client);

            this.logger.info(`Connected to MCP server: ${serverId}`);
        } catch (error) {
            this.logger.error(`Failed to connect to server ${serverId}:`, error);
        }
    }

    async aggregateTools() {
        this.tools = [];
        this.toolImplementations.clear();

        for (const [serverId, client] of this.clients) {
            try {
                const serverTools = await client.listTools();

                for (const tool of serverTools) {
                    // Convert MCP tool to OpenAI function format
                    const openAITool = this.convertToOpenAIFormat(tool);
                    this.tools.push(openAITool);

                    // Store implementation reference
                    this.toolImplementations.set(tool.name, {
                        client,
                        serverId,
                        originalTool: tool,
                    });
                }
            } catch (error) {
                this.logger.error(`Failed to list tools from ${serverId}:`, error);
            }
        }
    }

    convertToOpenAIFormat(mcpTool) {
        return {
            type: 'function',
            function: {
                name: mcpTool.name,
                description: mcpTool.description,
                parameters: mcpTool.inputSchema,
            },
        };
    }

    // Maintain ToolManager interface
    async loadTools() {
        await this.initialize();
    }

    getTools() {
        return this.tools;
    }

    getToolsCount() {
        return this.tools.length;
    }

    hasToolDefinition(toolName) {
        return this.toolImplementations.has(toolName);
    }

    async executeToolCall(toolCall, consoleInterface, snapshotManager = null) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        const implementation = this.toolImplementations.get(toolName);
        if (!implementation) {
            return this.createErrorResponse(toolCall.id, `Tool not found: ${toolName}`);
        }

        try {
            // Show tool execution info
            consoleInterface.showToolExecution(toolName, toolArgs);

            // Call MCP server
            const result = await implementation.client.callTool(toolName, toolArgs);

            // Parse result content
            let content = '';
            if (result.content && result.content.length > 0) {
                content = result.content[0].text;
            }

            // Try to parse as JSON for structured results
            let parsedResult;
            try {
                parsedResult = JSON.parse(content);
            } catch {
                parsedResult = { content, success: true };
            }

            // Standardize result format
            const standardizedResult = {
                success: true,
                timestamp: new Date().toISOString(),
                tool_name: toolName,
                ...parsedResult,
            };

            consoleInterface.showToolResult(standardizedResult);

            return {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(standardizedResult),
            };
        } catch (error) {
            const errorResult = {
                error: `Tool execution failed: ${error.message}`,
                tool_name: toolName,
                success: false,
                timestamp: new Date().toISOString(),
            };

            consoleInterface.showToolResult(errorResult);

            return {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(errorResult),
            };
        }
    }

    createErrorResponse(toolCallId, message) {
        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: JSON.stringify({
                error: message,
                success: false,
                timestamp: new Date().toISOString(),
            }),
        };
    }

    async loadConfiguration() {
        // Load MCP configuration from config/mcp/servers.json
        try {
            const configPath = join(process.cwd(), 'config/mcp/servers.json');
            const configContent = readFileSync(configPath, 'utf8');
            return JSON.parse(configContent);
        } catch (error) {
            this.logger.warn('No MCP configuration found, using defaults');
            return this.getDefaultConfiguration();
        }
    }

    getDefaultConfiguration() {
        return {
            servers: {
                'synth-dev-tools': {
                    type: 'stdio',
                    command: 'node',
                    args: ['mcp/server/main.js'],
                    description: 'Synth-Dev built-in tools',
                },
            },
        };
    }
}
```

### Configuration Files

#### MCP Server Configuration

```json
// config/mcp/servers.json
{
    "servers": {
        "synth-dev-tools": {
            "type": "stdio",
            "command": "node",
            "args": ["mcp/server/main.js"],
            "description": "Synth-Dev built-in tools",
            "enabled": true,
            "timeout": 30000,
            "retries": 3
        },
        "external-filesystem": {
            "type": "http",
            "url": "http://localhost:3001/mcp",
            "description": "External filesystem tools",
            "enabled": false,
            "timeout": 15000,
            "retries": 2,
            "headers": {
                "Authorization": "Bearer ${MCP_EXTERNAL_TOKEN}"
            }
        }
    },
    "client": {
        "timeout": 30000,
        "retries": 3,
        "discovery": {
            "enabled": true,
            "sources": ["config", "environment"]
        },
        "logging": {
            "level": "info",
            "requests": false,
            "responses": false
        }
    }
}
```

#### MCP Capabilities Configuration

```json
// config/mcp/capabilities.json
{
    "server": {
        "tools": {
            "listChanged": true
        },
        "resources": {
            "subscribe": true,
            "listChanged": true
        },
        "prompts": {
            "listChanged": true
        },
        "logging": {}
    },
    "client": {
        "sampling": {},
        "roots": {
            "listChanged": true
        }
    }
}
```

### Integration Points

#### App.js Integration

```javascript
// app.js - Modified initialization
import { McpClientManager } from './mcp/client/McpClientManager.js';
import ToolManager from './toolManager.js';

// Feature flag for MCP migration
const USE_MCP_TOOLS = process.env.USE_MCP_TOOLS === 'true';

async function initializeToolManager() {
    if (USE_MCP_TOOLS) {
        console.log('🔧 Initializing MCP Tool Manager...');
        const mcpManager = new McpClientManager();
        await mcpManager.initialize();
        return mcpManager;
    } else {
        console.log('🔧 Initializing Legacy Tool Manager...');
        const toolManager = new ToolManager();
        await toolManager.loadTools();
        return toolManager;
    }
}

// Rest of app.js remains unchanged
const toolManager = await initializeToolManager();
```

#### Command Integration

```javascript
// commands/system/McpCommand.js - New command for MCP management
import { BaseCommand } from '../base/BaseCommand.js';

export class McpCommand extends BaseCommand {
    constructor() {
        super('mcp', 'Manage MCP servers and connections');
    }

    async execute(args, context) {
        const subcommand = args[0];

        switch (subcommand) {
            case 'list':
                return this.listServers(context);
            case 'connect':
                return this.connectServer(args[1], context);
            case 'disconnect':
                return this.disconnectServer(args[1], context);
            case 'status':
                return this.showStatus(context);
            default:
                return this.showHelp();
        }
    }

    async listServers(context) {
        if (context.toolManager instanceof McpClientManager) {
            const servers = Array.from(context.toolManager.clients.keys());
            context.consoleInterface.showInfo(`Connected MCP servers: ${servers.join(', ')}`);
        } else {
            context.consoleInterface.showInfo('MCP not enabled. Set USE_MCP_TOOLS=true');
        }
        return 'handled';
    }

    showHelp() {
        const help = `
MCP Commands:
  /mcp list              - List connected MCP servers
  /mcp connect <server>  - Connect to MCP server
  /mcp disconnect <server> - Disconnect from MCP server
  /mcp status           - Show MCP connection status
        `.trim();

        console.log(help);
        return 'handled';
    }
}
```

### Testing Framework

#### MCP Protocol Tests

```javascript
// tests/unit/mcp/McpServer.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '../../../mcp/server/McpServer.js';
import { MockTransport } from '../../mocks/MockTransport.js';

describe('McpServer', () => {
    let server;
    let transport;

    beforeEach(() => {
        server = new McpServer({
            name: 'test-server',
            version: '1.0.0',
        });
        transport = new MockTransport();
    });

    it('should handle initialize request', async () => {
        await server.connect(transport);

        const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-03-26',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0.0' },
            },
        };

        const response = await server.processRequest(request);

        expect(response.result.protocolVersion).toBe('2025-03-26');
        expect(response.result.serverInfo.name).toBe('test-server');
    });

    it('should list tools', async () => {
        // Register a test tool
        server.registerTool('test-tool', {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} },
            execute: async () => ({ success: true }),
        });

        const request = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
        };

        const response = await server.processRequest(request);

        expect(response.result.tools).toHaveLength(1);
        expect(response.result.tools[0].name).toBe('test-tool');
    });

    it('should execute tool calls', async () => {
        server.registerTool('echo', {
            name: 'echo',
            description: 'Echo input',
            inputSchema: {
                type: 'object',
                properties: { message: { type: 'string' } },
            },
            execute: async args => ({ echo: args.message }),
        });

        const request = {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'echo',
                arguments: { message: 'hello' },
            },
        };

        const response = await server.processRequest(request);
        const result = JSON.parse(response.result.content[0].text);

        expect(result.echo).toBe('hello');
    });
});
```

#### Integration Tests

```javascript
// tests/integration/mcp/ToolExecution.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpClientManager } from '../../../mcp/client/McpClientManager.js';
import { spawn } from 'child_process';

describe('MCP Tool Execution Integration', () => {
    let clientManager;
    let serverProcess;

    beforeEach(async () => {
        // Start MCP server process
        serverProcess = spawn('node', ['mcp/server/main.js'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Initialize client manager
        clientManager = new McpClientManager();
        await clientManager.initialize();
    });

    afterEach(() => {
        if (serverProcess) {
            serverProcess.kill();
        }
    });

    it('should execute read_file tool via MCP', async () => {
        const toolCall = {
            id: 'test-call-1',
            function: {
                name: 'read_file',
                arguments: JSON.stringify({
                    file_path: 'package.json',
                }),
            },
        };

        const mockConsoleInterface = {
            showToolExecution: vi.fn(),
            showToolResult: vi.fn(),
        };

        const result = await clientManager.executeToolCall(toolCall, mockConsoleInterface);

        expect(result.role).toBe('tool');
        expect(result.tool_call_id).toBe('test-call-1');

        const content = JSON.parse(result.content);
        expect(content.success).toBe(true);
        expect(content.content).toContain('"name": "synth-dev"');
    });

    it('should handle tool execution errors', async () => {
        const toolCall = {
            id: 'test-call-2',
            function: {
                name: 'read_file',
                arguments: JSON.stringify({
                    file_path: 'nonexistent-file.txt',
                }),
            },
        };

        const mockConsoleInterface = {
            showToolExecution: vi.fn(),
            showToolResult: vi.fn(),
        };

        const result = await clientManager.executeToolCall(toolCall, mockConsoleInterface);

        const content = JSON.parse(result.content);
        expect(content.success).toBe(false);
        expect(content.error).toContain('File not found');
    });
});
```

### Performance Monitoring

#### Benchmark Suite

```javascript
// tests/performance/McpPerformance.test.js
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';
import { McpClientManager } from '../../mcp/client/McpClientManager.js';
import ToolManager from '../../toolManager.js';

describe('MCP Performance Benchmarks', () => {
    it('should have comparable tool loading performance', async () => {
        // Benchmark legacy tool manager
        const legacyStart = performance.now();
        const legacyManager = new ToolManager();
        await legacyManager.loadTools();
        const legacyTime = performance.now() - legacyStart;

        // Benchmark MCP client manager
        const mcpStart = performance.now();
        const mcpManager = new McpClientManager();
        await mcpManager.initialize();
        const mcpTime = performance.now() - mcpStart;

        // MCP should be within 50% of legacy performance
        expect(mcpTime).toBeLessThan(legacyTime * 1.5);

        console.log(`Legacy: ${legacyTime.toFixed(2)}ms, MCP: ${mcpTime.toFixed(2)}ms`);
    });

    it('should have comparable tool execution performance', async () => {
        const mcpManager = new McpClientManager();
        await mcpManager.initialize();

        const legacyManager = new ToolManager();
        await legacyManager.loadTools();

        const toolCall = {
            id: 'perf-test',
            function: {
                name: 'calculate',
                arguments: JSON.stringify({ expression: '2 + 2' }),
            },
        };

        const mockConsole = {
            showToolExecution: () => {},
            showToolResult: () => {},
        };

        // Benchmark legacy execution
        const legacyStart = performance.now();
        await legacyManager.executeToolCall(toolCall, mockConsole);
        const legacyTime = performance.now() - legacyStart;

        // Benchmark MCP execution
        const mcpStart = performance.now();
        await mcpManager.executeToolCall(toolCall, mockConsole);
        const mcpTime = performance.now() - mcpStart;

        // MCP should be within 20% of legacy performance
        expect(mcpTime).toBeLessThan(legacyTime * 1.2);

        console.log(`Legacy exec: ${legacyTime.toFixed(2)}ms, MCP exec: ${mcpTime.toFixed(2)}ms`);
    });
});
```

## Migration Checklist

### Pre-Migration

- [ ] Install MCP TypeScript SDK dependency
- [ ] Create MCP directory structure
- [ ] Implement MCP server core classes
- [ ] Implement MCP client core classes
- [ ] Create configuration files
- [ ] Set up feature flags

### Phase 1: Server Implementation

- [ ] Implement McpServer class
- [ ] Implement McpToolAdapter class
- [ ] Implement StdioTransport class
- [ ] Create server entry point (main.js)
- [ ] Test server with MCP inspector
- [ ] Validate all existing tools work via MCP

### Phase 2: Client Implementation

- [ ] Implement McpClient class
- [ ] Implement McpClientManager class
- [ ] Implement client transports
- [ ] Create configuration loading
- [ ] Test client-server communication
- [ ] Validate tool execution parity

### Phase 3: Integration

- [ ] Add feature flag to app.js
- [ ] Create MCP management commands
- [ ] Update documentation
- [ ] Create migration scripts
- [ ] Test dual-mode operation
- [ ] Performance benchmarking

### Phase 4: Testing & Validation

- [ ] Unit tests for all MCP components
- [ ] Integration tests for tool execution
- [ ] Performance regression tests
- [ ] Error handling validation
- [ ] Protocol compliance tests
- [ ] End-to-end workflow tests

### Phase 5: Deployment

- [ ] Gradual rollout with feature flags
- [ ] Monitor performance metrics
- [ ] User acceptance testing
- [ ] Documentation updates
- [ ] Training materials
- [ ] Rollback procedures

### Post-Migration

- [ ] Remove legacy code paths
- [ ] Clean up configuration
- [ ] Update CI/CD pipelines
- [ ] Archive old tool system
- [ ] Celebrate successful migration! 🎉

This comprehensive implementation plan provides all the necessary code, configurations, and procedures to successfully migrate Synth-Dev to the Model Context Protocol while maintaining full backward compatibility and opening up new possibilities for tool integration.

```

```
