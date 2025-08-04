# AI Providers Configuration

SynthDev supports multiple AI providers and models, allowing you to choose the best combination for your needs. The system includes detailed provider configurations with model specifications, pricing, and parameters.

## Supported Providers

### OpenAI

- **Models**: GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, o4-mini, GPT-4o, GPT-4o-mini
- **Features**: Large context windows, reasoning models, competitive pricing
- **Best for**: General development tasks, code generation, complex reasoning

### Anthropic

- **Models**: Claude Sonnet 4, Claude Opus 4, Claude 3.5 Haiku
- **Features**: Strong reasoning, safety-focused, large context windows
- **Best for**: Complex analysis, safety-critical applications, detailed explanations

### Google AI

- **Models**: Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash Lite
- **Features**: Fast inference, competitive pricing, large context windows
- **Best for**: High-throughput applications, cost-sensitive projects

### XAI (Grok)

- **Models**: Grok 3 Mini Beta
- **Features**: Real-time information, unique perspective
- **Best for**: Current events, creative tasks, alternative viewpoints

### OpenRouter

- **Models**: Access to multiple providers through single API
- **Features**: Model aggregation, competitive pricing, easy switching
- **Best for**: Model experimentation, cost optimization, fallback options

## Provider Configuration

### Basic Setup

Configure providers through environment variables:

```env
# Primary provider (required)
SYNTHDEV_API_KEY=your_api_key
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

### Multi-Provider Setup

Use different providers for different model tiers:

```env
# Base model - OpenAI
SYNTHDEV_API_KEY=sk-your-openai-key
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1

# Smart model - Anthropic
SYNTHDEV_SMART_API_KEY=sk-ant-your-anthropic-key
SYNTHDEV_SMART_MODEL=claude-sonnet-4-20250514
SYNTHDEV_SMART_BASE_URL=https://api.anthropic.com/v1

# Fast model - Google
SYNTHDEV_FAST_API_KEY=your-google-key
SYNTHDEV_FAST_MODEL=gemini-2.5-flash
SYNTHDEV_FAST_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

## Model Specifications

### OpenAI Models

#### GPT-4.1 Series

```json
{
    "gpt-4.1": {
        "contextSize": 1000000,
        "maxResponseSize": 32000,
        "inputPrice": "$2.00/M tokens",
        "outputPrice": "$8.00/M tokens",
        "cachedPrice": "$0.50/M tokens"
    },
    "gpt-4.1-mini": {
        "contextSize": 1000000,
        "maxResponseSize": 32000,
        "inputPrice": "$0.40/M tokens",
        "outputPrice": "$1.60/M tokens",
        "cachedPrice": "$0.10/M tokens"
    },
    "gpt-4.1-nano": {
        "contextSize": 1000000,
        "maxResponseSize": 32000,
        "inputPrice": "$0.10/M tokens",
        "outputPrice": "$0.40/M tokens",
        "cachedPrice": "$0.025/M tokens"
    }
}
```

#### Reasoning Models

```json
{
    "o4-mini": {
        "contextSize": 200000,
        "maxResponseSize": 100000,
        "inputPrice": "$1.10/M tokens",
        "outputPrice": "$4.40/M tokens",
        "reasoning": true,
        "bestFor": "Complex problem solving"
    }
}
```

### Anthropic Models

```json
{
    "claude-sonnet-4-20250514": {
        "contextSize": 200000,
        "maxResponseSize": 64000,
        "inputPrice": "$3.00/M tokens",
        "outputPrice": "$15.00/M tokens",
        "cachedPrice": "$0.75/M tokens",
        "bestFor": "Balanced performance and cost"
    },
    "claude-opus-4-20250514": {
        "contextSize": 200000,
        "maxResponseSize": 32000,
        "inputPrice": "$15.00/M tokens",
        "outputPrice": "$75.00/M tokens",
        "cachedPrice": "$3.75/M tokens",
        "bestFor": "Highest quality reasoning"
    }
}
```

### Google AI Models

```json
{
    "gemini-2.5-flash": {
        "contextSize": 1000000,
        "maxResponseSize": 32000,
        "inputPrice": "$0.30/M tokens",
        "outputPrice": "$2.50/M tokens",
        "cachedPrice": "$0.0875/M tokens",
        "bestFor": "Fast, cost-effective tasks"
    },
    "gemini-2.5-pro": {
        "contextSize": 1000000,
        "maxResponseSize": 32000,
        "inputPrice": "$1.25/M tokens",
        "outputPrice": "$10.00/M tokens",
        "cachedPrice": "$0.3125/M tokens",
        "bestFor": "High-quality reasoning"
    }
}
```

## Model Selection Strategy

### By Use Case

#### Development Tasks

- **Primary**: `gpt-4.1-mini` (OpenAI) - Good balance of capability and cost
- **Alternative**: `gemini-2.5-flash` (Google) - Fast and cost-effective

#### Complex Reasoning

- **Primary**: `claude-sonnet-4` (Anthropic) - Excellent reasoning capabilities
- **Alternative**: `o4-mini` (OpenAI) - Specialized reasoning model

#### High-Volume Tasks

- **Primary**: `gpt-4.1-nano` (OpenAI) - Lowest cost
- **Alternative**: `gemini-2.5-flash-lite` (Google) - Ultra-low cost

#### Critical Applications

- **Primary**: `claude-opus-4` (Anthropic) - Highest quality
- **Alternative**: `gpt-4.1` (OpenAI) - Premium performance

### By Budget

#### Budget-Conscious

```env
SYNTHDEV_BASE_MODEL=gpt-4.1-nano
SYNTHDEV_SMART_MODEL=gemini-2.5-flash
SYNTHDEV_FAST_MODEL=gemini-2.5-flash-lite-preview-06-17
```

#### Balanced

```env
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_SMART_MODEL=claude-sonnet-4-20250514
SYNTHDEV_FAST_MODEL=gpt-4.1-nano
```

#### Premium

```env
SYNTHDEV_BASE_MODEL=gpt-4.1
SYNTHDEV_SMART_MODEL=claude-opus-4-20250514
SYNTHDEV_FAST_MODEL=gpt-4.1-mini
```

## Provider-Specific Configuration

### Custom Parameters

Each provider supports specific parameters that can be configured in `src/config/defaults/providers.json`:

```json
{
    "defaultParameters": {
        "temperature": 0.7,
        "top_p": 0.9,
        "frequency_penalty": 0,
        "presence_penalty": 0
    }
}
```

### OpenRouter Configuration

OpenRouter provides access to multiple models through a single API:

```env
SYNTHDEV_API_KEY=your-openrouter-key
SYNTHDEV_BASE_MODEL=google/gemini-2.5-flash
SYNTHDEV_BASE_URL=https://openrouter.ai/api/v1
```

Available models include:

- `google/gemini-2.5-flash`
- `anthropic/claude-sonnet-4`
- `deepseek/deepseek-r1-0528`
- And many more...

## Custom Provider Setup

### Local Models

Configure local or custom API endpoints:

```env
SYNTHDEV_API_KEY=your-local-key
SYNTHDEV_BASE_MODEL=your-model-name
SYNTHDEV_BASE_URL=http://localhost:8080/v1
```

### Adding New Providers

To add a new provider, edit `src/config/defaults/providers.json`:

```json
{
    "providers": [
        {
            "name": "YourProvider",
            "models": [
                {
                    "name": "your-model",
                    "contextSize": 100000,
                    "maxResponseSize": 4000,
                    "inputPricePerMillionTokens": 1.0,
                    "outputPricePerMillionTokens": 2.0,
                    "defaultParameters": {
                        "temperature": 0.7,
                        "top_p": 0.9
                    }
                }
            ],
            "baseUrl": "https://api.yourprovider.com/v1"
        }
    ]
}
```

## Best Practices

### API Key Management

- Use separate API keys for different environments
- Implement key rotation policies
- Monitor usage and costs
- Set up billing alerts

### Model Selection

- Start with cost-effective models for development
- Use premium models for production critical tasks
- Implement fallback strategies
- Monitor performance metrics

### Performance Optimization

- Use cached tokens when available
- Implement request batching
- Monitor response times
- Set appropriate timeouts

## Next Steps

- [Configure AI Roles](./roles.md) - Define how AI behaves with different providers
- [Environment Variables](./environment-variables.md) - Detailed environment setup
- [Troubleshooting](./troubleshooting.md) - Common provider issues
