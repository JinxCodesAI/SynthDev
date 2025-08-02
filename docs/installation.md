# SynthDev Installation Guide

This guide provides complete installation instructions for SynthDev, including prerequisites, setup, configuration, and verification steps.

## Prerequisites

### System Requirements

- **Node.js**: Version 20.10.0 or higher
- **npm**: Version 10.0.0 or higher (comes with Node.js)
- **Git**: For snapshot management and version control
- **Operating System**: Windows, macOS, or Linux

### AI API Access

SynthDev requires access to AI APIs. You'll need at least one of:

- **OpenAI API**: GPT-4, GPT-3.5, or other OpenAI models
- **Anthropic API**: Claude models
- **Google AI API**: Gemini models
- **Local/Custom API**: Any OpenAI-compatible API endpoint

## Installation Methods

### Method 1: Clone from Repository (Recommended)

```bash
# Clone the repository
git clone https://github.com/JinxCodesAI/SynthDev.git
cd SynthDev

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit configuration (see Configuration section below)
nano .env
```

### Method 2: Download Release

1. Download the latest release from GitHub
2. Extract the archive
3. Navigate to the extracted directory
4. Follow the same steps as Method 1 starting from `npm install`

### Method 3: Development Setup

```bash
# Clone with development branch
git clone -b develop https://github.com/JinxCodesAI/SynthDev.git
cd SynthDev

# Install dependencies including dev dependencies
npm install

# Set up development environment
npm run setup:dev

# Copy environment template
cp .env.example .env
```

## Configuration

### Basic Configuration

Edit the `.env` file with your API credentials:

```env
# Required: Base Model Configuration
SYNTHDEV_API_KEY=your_api_key_here
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1

# Optional: Application Settings
SYNTHDEV_MAX_TOOL_CALLS=50
SYNTHDEV_VERBOSITY_LEVEL=2
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false

# Optional: Development Settings
NODE_ENV=development
DEBUG=false
```

### Multi-Model Setup (Optional)

For enhanced functionality, configure multiple models:

```env
# Base Model (Required)
SYNTHDEV_API_KEY=your_openai_key
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1

# Smart Model (Optional - for complex reasoning)
SYNTHDEV_SMART_API_KEY=your_smart_model_key
SYNTHDEV_SMART_MODEL=gpt-4.1-mini
SYNTHDEV_SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (Optional - for quick tasks)
SYNTHDEV_FAST_API_KEY=your_fast_model_key
SYNTHDEV_FAST_MODEL=gpt-4.1-nano
SYNTHDEV_FAST_BASE_URL=https://api.openai.com/v1
```

### API Provider Examples

#### OpenAI

```env
SYNTHDEV_API_KEY=sk-your-openai-api-key
SYNTHDEV_BASE_MODEL=gpt-4.1-mini
SYNTHDEV_BASE_URL=https://api.openai.com/v1
```

#### Anthropic Claude

```env
SYNTHDEV_API_KEY=sk-ant-your-anthropic-key
SYNTHDEV_BASE_MODEL=claude-3-haiku-20240307
SYNTHDEV_BASE_URL=https://api.anthropic.com/v1
```

#### Google AI

```env
SYNTHDEV_API_KEY=your-google-ai-key
SYNTHDEV_BASE_MODEL=gemini-1.5-flash
SYNTHDEV_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

#### Local/Custom Provider

```env
SYNTHDEV_API_KEY=your-local-api-key
SYNTHDEV_BASE_MODEL=your-model-name
SYNTHDEV_BASE_URL=http://localhost:8080/v1
```

## Verification

### Test Installation

```bash
# Test basic functionality
npm start

# You should see the SynthDev startup message
# Try a simple command:
/help

# Test AI functionality
Hello, can you help me?

# Test tool functionality
/tools
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Check test coverage
npm run test:coverage
```

### Verify Configuration

```bash
# Check configuration
/config

# Test different AI roles
/role coder
/role reviewer

# Test workflow system
/workflows
```

## Development Setup

### Additional Development Dependencies

```bash
# Install development tools
npm install --save-dev

# Set up pre-commit hooks
npm run setup:hooks

# Install global development tools (optional)
npm install -g nodemon jest-cli
```

### Development Environment Variables

```env
# Development-specific settings
NODE_ENV=development
DEBUG=true
SYNTHDEV_VERBOSITY_LEVEL=3
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=true

# Test environment settings
SYNTHDEV_TEST_API_KEY=test-key-for-mocking
```

### IDE Setup

#### VS Code

Install recommended extensions:

```json
{
    "recommendations": [
        "ms-vscode.vscode-json",
        "bradlc.vscode-tailwindcss",
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-eslint"
    ]
}
```

#### WebStorm/IntelliJ

1. Enable Node.js support
2. Configure ESLint integration
3. Set up Jest test runner
4. Configure code formatting

## Troubleshooting

### Common Installation Issues

#### Node.js Version Issues

```bash
# Check Node.js version
node --version

# If version is too old, update Node.js
# Visit https://nodejs.org/ for latest version
```

#### Permission Issues (Linux/macOS)

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use a Node version manager like nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

#### Windows-Specific Issues

```powershell
# Run as Administrator if needed
# Enable execution policy for scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install Windows Build Tools if needed
npm install --global windows-build-tools
```

### Configuration Issues

#### Missing API Key

```
Error: SYNTHDEV_API_KEY is required
```

**Solution**: Add your API key to the `.env` file

#### Invalid URL Format

```
Error: Invalid SYNTHDEV_BASE_URL format
```

**Solution**: Ensure URL includes protocol (http:// or https://)

#### API Connection Issues

```bash
# Test API connectivity
curl -H "Authorization: Bearer your_api_key" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}' \
     https://api.openai.com/v1/chat/completions
```

### Runtime Issues

#### Tool Execution Failures

1. Check file permissions
2. Verify working directory
3. Check path validation settings
4. Review security patterns

#### Memory Issues

```env
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=4096
```

#### Performance Issues

```env
# Reduce verbosity
SYNTHDEV_VERBOSITY_LEVEL=1

# Limit tool calls
SYNTHDEV_MAX_TOOL_CALLS=20

# Disable prompt enhancement
SYNTHDEV_ENABLE_PROMPT_ENHANCEMENT=false
```

## Production Deployment

### Environment Setup

```env
# Production configuration
NODE_ENV=production
DEBUG=false
SYNTHDEV_VERBOSITY_LEVEL=1
SYNTHDEV_MAX_TOOL_CALLS=30
```

### Security Considerations

1. **API Keys**: Use environment variables, never commit to version control
2. **File Permissions**: Restrict file system access appropriately
3. **Network Access**: Configure firewall rules if needed
4. **Logging**: Set appropriate log levels for production
5. **Updates**: Keep dependencies updated for security patches

### Process Management

```bash
# Using PM2 for production
npm install -g pm2

# Start SynthDev with PM2
pm2 start npm --name "synthdev" -- start

# Monitor
pm2 status
pm2 logs synthdev

# Auto-restart on system reboot
pm2 startup
pm2 save
```

### Docker Deployment (Optional)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t synthdev .
docker run -d --name synthdev -p 3000:3000 --env-file .env synthdev
```

## Updates and Maintenance

### Updating SynthDev

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Run tests to verify
npm test

# Restart application
npm start
```

### Backup and Recovery

```bash
# Backup configuration
cp .env .env.backup
cp -r src/config src/config.backup

# Backup conversation snapshots
cp -r .synthdev-snapshots .synthdev-snapshots.backup
```

### Monitoring

```bash
# Check application health
/status

# Monitor API usage
/costs

# Check system resources
top
df -h
```

## Getting Help

### Documentation

- **Configuration**: See [Configuration.md](Configuration.md)
- **Architecture**: See [Architecture.md](Architecture.md)
- **Tools**: See [Tools.md](Tools.md)

### Support Channels

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share ideas
- **Documentation**: Check guides for detailed information
- **Examples**: Look at existing configurations and workflows

### Diagnostic Information

When seeking help, include:

```bash
# System information
node --version
npm --version
git --version

# SynthDev configuration (without API keys)
/config

# Error logs
tail -n 50 synthdev.log
```

---

_For detailed configuration options, see [Configuration.md](Configuration.md). For development guidelines, see the Architecture and Testing guides._
