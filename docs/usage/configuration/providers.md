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

## Custom Provider Parameters

**File**: `src/config/defaults/providers.json`

To modify default parameters for providers, edit the `defaultParameters` section:

```json
{
  "providers": [
    {
      "name": "OpenAI",
      "models": [
        {
          "name": "gpt-4.1-mini",
          "defaultParameters": {
            "temperature": 0.7,
            "top_p": 0.9,
            "frequency_penalty": 0,
            "presence_penalty": 0
          }
        }
      ]
    }
  ]
}
```

## Adding Custom Providers

**File**: `src/config/defaults/providers.json`

Add new providers to the `providers` array:

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

## Local/Custom Endpoints

For local models or custom API endpoints:

```env
SYNTHDEV_API_KEY=your-local-key
SYNTHDEV_BASE_MODEL=your-model-name
SYNTHDEV_BASE_URL=http://localhost:8080/v1
```
