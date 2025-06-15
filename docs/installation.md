# Installation & Setup Guide

This guide provides detailed instructions for installing and setting up SynthDev on different platforms and environments.

## System Requirements

- **Node.js**: Version 20.10.0 or higher (ES Modules support required)
- **Operating System**: Windows, WSL, Linux (macOS not tested)
- **AI API**: Compatible with OpenAI API and similar services
- **Memory**: Minimum 4GB RAM recommended
- **Storage**: At least 1GB free space for dependencies and codebase indexing

## Installation Methods

### Method 1: Native Installation

Best for: Direct development and customization

#### Step 1: Clone Repository

```bash
git clone https://github.com/JinxCodesAI/SynthDev.git
cd SynthDev
```

#### Step 2: Install Dependencies

```bash
npm install
```

#### Step 3: Configure Environment

```bash
cp config.example.env .env
```

Edit `.env` with your configuration (see Configuration section below).

#### Step 4: Start Application

```bash
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
```

### Method 2: Docker Installation (Recommended)

Best for: Isolated environments and project-specific usage

#### Prerequisites

- Docker Desktop installed and running
- Git for cloning the repository

#### Step 1: Initial Setup

```bash
# Clone repository
git clone https://github.com/JinxCodesAI/SynthDev.git
cd SynthDev

# Initial setup (creates .env and builds image)
# Windows:
./docker-run.bat setup
# Linux/macOS:
./docker-run.sh setup
```

#### Step 2: Configure Environment

Edit the `.env` file with your API keys (same format as native installation).

#### Step 3: Run SynthDev

**From SynthDev source directory:**

```bash
# Windows:
./docker-run.bat run
# Linux/macOS:
./docker-run.sh run
```

**From any project directory:**

```bash
# Windows:
./docker-run.bat run --path "C:\path\to\your\project"
# Linux/macOS:
./docker-run.sh run --path "/path/to/your/project"
```

#### Docker Commands Reference

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `setup`             | Initial setup and build         |
| `run`               | Run interactively (recommended) |
| `run --path "path"` | Run from custom directory       |
| `start`             | Start in production mode        |
| `dev`               | Start in development mode       |
| `stop`              | Stop the application            |
| `logs`              | View application logs           |
| `shell`             | Open shell in container         |
| `clean`             | Remove containers and volumes   |
| `status`            | Show container status           |

#### How Docker Mode Works

When using `--path`, SynthDev:

1. **Installs globally** in the container via `npm install -g .`
2. **Mounts your directory** as the working directory
3. **Loads environment variables** from the `.env` file automatically
4. **Runs as CLI tool** from your project directory

### Method 3: Global Installation

Best for: System-wide availability across multiple projects

#### Step 1: Install Globally

```bash
# From SynthDev project directory
npm install -g .
```

#### Step 2: Use Anywhere

```bash
# Available system-wide
synth-dev
```

#### Operating Context

- **Working Directory**: Application operates in current directory
- **Configuration**: Place `.env` file in working directory
- **File Operations**: Relative to current working directory

## Configuration

### Required Environment Variables

```env
# Base Model Configuration (Required)
API_KEY=your_api_key_here
BASE_MODEL=gpt-4.1-mini
BASE_URL=https://api.openai.com/v1
```

### Optional Model Configurations

```env
# Smart Model (for Architect role)
SMART_API_KEY=your_smart_api_key
SMART_MODEL=gpt-4.1-mini
SMART_BASE_URL=https://api.openai.com/v1

# Fast Model (for quick tasks)
FAST_API_KEY=your_fast_api_key
FAST_MODEL=gpt-4.1-nano
FAST_BASE_URL=https://api.openai.com/v1
```

### Application Settings

```env
# Tool and Safety Settings
MAX_TOOL_CALLS=50
ENABLE_PROMPT_ENHANCEMENT=false

# Output Control
VERBOSITY_LEVEL=2

# Development Settings
NODE_ENV=development
DEBUG=false
```

### API Provider Examples

#### OpenAI

```env
API_KEY=sk-your-openai-key
BASE_MODEL=gpt-4.1-mini
BASE_URL=https://api.openai.com/v1
```

#### Google AI

```env
API_KEY=your-google-ai-key
BASE_MODEL=gemini-1.5-flash
BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

#### Local/Custom Provider

```env
API_KEY=your-local-key
BASE_MODEL=your-model-name
BASE_URL=http://localhost:8080/v1
```

## Verification

### Test Installation

```bash
# Check version
synth-dev --version

# Test basic functionality
synth-dev
# Then try: /help
```

### Test Configuration

```bash
# Check configuration
/cost
# Should show API configuration

# Test AI response
Hello, can you help me?
```

### Test Tools

```bash
# List available tools
/tools

# Test file operations
/role file_reader
Please list the files in the current directory
```

## Troubleshooting

### Common Issues

#### Node.js Version Error

```
Error: SynthDev requires Node.js 20.10.0 or higher
```

**Solution**: Update Node.js to version 20.10.0 or higher

#### Missing API Key

```
Configuration error: API_KEY is required
```

**Solution**: Add API_KEY to your `.env` file

#### Docker Permission Issues

```
Permission denied: ./docker-run.sh
```

**Solution**: Make script executable

```bash
chmod +x docker-run.sh
```

#### Module Not Found

```
Error: Cannot find module './configManager.js'
```

**Solution**: Ensure you're in the correct directory and dependencies are installed

```bash
npm install
```

### Platform-Specific Issues

#### Windows

- Use `docker-run.bat` instead of `docker-run.sh`
- Ensure Docker Desktop is running
- Use PowerShell or Command Prompt

#### WSL (Windows Subsystem for Linux)

- Use Linux commands (`docker-run.sh`)
- Ensure Docker Desktop has WSL integration enabled
- File paths should use Linux format

#### Linux

- Ensure Docker daemon is running
- User may need to be in docker group
- Check file permissions for scripts

### Getting Help

1. **Check Logs**: Use `docker-run.sh logs` for Docker installations
2. **Verify Configuration**: Ensure all required environment variables are set
3. **Test API Connection**: Verify API keys and endpoints are correct
4. **GitHub Issues**: Report persistent issues with system details

## Next Steps

After successful installation:

1. **Read Configuration Guide**: Learn about advanced configuration options
2. **Explore AI Roles**: Try different AI personas with `/roles` and `/role <name>`
3. **Index Your Codebase**: Use `/index` to enable AI codebase understanding
4. **Customize Tools**: See tool-development.md for creating custom tools

---

_For advanced configuration options, see [Configuration Guide](configuration.md)_
