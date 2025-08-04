# AI Providers Configuration

Configure AI model providers by setting environment variables in your `.env` file.

## Configuration Location

**File**: `.env` (in your project root)

## Required Configuration

Set these environment variables for the base model (required):

```env
SYNTHDEV_API_KEY=your_api_key
SYNTHDEV_BASE_MODEL=model_name
SYNTHDEV_BASE_URL=provider_api_url
```

## Multi-Model Configuration

Configure up to three model tiers by adding these environment variables:

```env
# Base model (required)
SYNTHDEV_API_KEY=your_base_api_key
SYNTHDEV_BASE_MODEL=base_model_name
SYNTHDEV_BASE_URL=base_provider_url

# Smart model (optional)
SYNTHDEV_SMART_API_KEY=your_smart_api_key
SYNTHDEV_SMART_MODEL=smart_model_name
SYNTHDEV_SMART_BASE_URL=smart_provider_url

# Fast model (optional)
SYNTHDEV_FAST_API_KEY=your_fast_api_key
SYNTHDEV_FAST_MODEL=fast_model_name
SYNTHDEV_FAST_BASE_URL=fast_provider_url
```

## Provider-Specific Configuration

### OpenAI
```env
SYNTHDEV_API_KEY=sk-your-openai-key
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

Available models: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `o4-mini`, `gpt-4o`, `gpt-4o-mini`

### Anthropic
```env
SYNTHDEV_API_KEY=sk-ant-your-anthropic-key
SYNTHDEV_BASE_MODEL=claude-sonnet-4-20250514
SYNTHDEV_BASE_URL=https://api.anthropic.com/v1
```

Available models: `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-3-5-haiku-20241022`

### Google AI
```env
SYNTHDEV_API_KEY=your-google-ai-key
SYNTHDEV_BASE_MODEL=gemini-2.5-flash
SYNTHDEV_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

Available models: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite-preview-06-17`

### XAI (Grok)
```env
SYNTHDEV_API_KEY=your-xai-key
SYNTHDEV_BASE_MODEL=grok-3-mini-beta
SYNTHDEV_BASE_URL=https://api.x.ai/v1
```

Available models: `grok-3-mini-beta`

### OpenRouter
```env
SYNTHDEV_API_KEY=your-openrouter-key
SYNTHDEV_BASE_MODEL=google/gemini-2.5-flash
SYNTHDEV_BASE_URL=https://openrouter.ai/api/v1
```

Available models: Use provider/model format (e.g., `google/gemini-2.5-flash`, `anthropic/claude-sonnet-4`)

## Provider Configuration File

**File**: `src/config/defaults/providers.json`

This file defines all available AI providers and their models. Each provider entry contains:

### Provider Structure
```json
{
  "providers": [
    {
      "name": "ProviderName",
      "baseUrl": "https://api.provider.com/v1",
      "models": [
        {
          "name": "model-name",
          "contextSize": 100000,
          "maxResponseSize": 4000,
          "inputPricePerMillionTokens": 1.0,
          "outputPricePerMillionTokens": 2.0,
          "cachedPricePerMillionTokens": 0.5,
          "reasoning": false,
          "defaultParameters": {
            "temperature": 0.7,
            "top_p": 0.9,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "top_k": 40
          }
        }
      ]
    }
  ]
}
```

### Provider Parameters

#### Provider Level
- **`name`**: Provider identifier (string)
- **`baseUrl`**: Default API endpoint URL (string)
- **`models`**: Array of model configurations

#### Model Level
- **`name`**: Model identifier used in environment variables (string)
- **`contextSize`**: Maximum context window in tokens (number)
- **`maxResponseSize`**: Maximum response length in tokens (number)
- **`inputPricePerMillionTokens`**: Cost per million input tokens (number)
- **`outputPricePerMillionTokens`**: Cost per million output tokens (number)
- **`cachedPricePerMillionTokens`**: Cost per million cached tokens (number, optional)
- **`reasoning`**: Whether model supports reasoning mode (boolean, optional)

#### Default Parameters
- **`temperature`**: Randomness in responses (0.0-2.0, default: 0.7)
- **`top_p`**: Nucleus sampling parameter (0.0-1.0, default: 0.9)
- **`frequency_penalty`**: Penalty for frequent tokens (-2.0-2.0, default: 0)
- **`presence_penalty`**: Penalty for new topics (-2.0-2.0, default: 0)
- **`top_k`**: Top-k sampling parameter (number, Google models only)

## Adding Custom Providers

To add a new provider, append to the `providers` array:

```json
{
  "name": "CustomProvider",
  "baseUrl": "https://api.customprovider.com/v1",
  "models": [
    {
      "name": "custom-model-v1",
      "contextSize": 50000,
      "maxResponseSize": 2000,
      "inputPricePerMillionTokens": 0.5,
      "outputPricePerMillionTokens": 1.0,
      "defaultParameters": {
        "temperature": 0.8,
        "top_p": 0.95
      }
    }
  ]
}
```

## Local/Custom Endpoints

For local models or custom API endpoints, use environment variables:

```env
SYNTHDEV_API_KEY=your-local-key
SYNTHDEV_BASE_MODEL=your-model-name
SYNTHDEV_BASE_URL=http://localhost:8080/v1
```
