# Docker Setup for Synth-Dev

This document explains how to run Synth-Dev in an isolated Linux-based Docker environment.

## Prerequisites

- Docker Engine 20.10+ 
- Docker Compose 2.0+
- Your API keys for AI models (OpenAI, etc.)

## Quick Start

### 1. Environment Setup

Create a `.env` file in the project root with your configuration:

```bash
# Copy the example configuration
cp config.example.env .env

# Edit the .env file with your API keys
# At minimum, set your API_KEY
API_KEY=your_openai_api_key_here
```

### 2. Build and Run

**RECOMMENDED: Interactive Mode**
```bash
# For the best interactive experience (Windows)
docker-run.bat run

# For the best interactive experience (Linux/macOS)
./docker-run.sh run
```

**Alternative: Docker Compose**
```bash
# Build and start the application
docker-compose up --build

# Or run in detached mode (not recommended for interactive use)
docker-compose up -d --build
```

### 3. Interact with the Application

The application will start in interactive mode. You can:
- Type commands and interact with the AI assistant directly
- Use all console features like command history
- Press Ctrl+C to stop the application
- The application requires user input, so interactive mode is essential

## Usage Modes

### Interactive Mode (RECOMMENDED)

For the best user experience with full interactive console support:

```bash
# Windows
docker-run.bat run

# Linux/macOS
./docker-run.sh run
```

This mode provides:
- Full interactive terminal support
- Proper stdin/stdout handling
- Best user input experience
- Direct console interaction

### Production Mode

```bash
# Start the application
docker-compose up

# Stop the application
docker-compose down
```

### Development Mode

For development with hot reload:

```bash
# Start in development mode
docker-compose --profile dev up synth-dev-dev

# Or build and start
docker-compose --profile dev up --build synth-dev-dev
```

## Configuration

### Environment Variables

Set these in your `.env` file:

```env
# Required: Base API configuration
API_KEY=your_base_model_api_key
BASE_MODEL=gpt-4o-mini
BASE_URL=https://api.openai.com/v1

# Optional: Smart model configuration
SMART_API_KEY=your_smart_model_api_key
SMART_MODEL=gpt-4o
SMART_BASE_URL=https://api.openai.com/v1

# Optional: Fast model configuration  
FAST_API_KEY=your_fast_model_api_key
FAST_MODEL=gpt-4o-mini
FAST_BASE_URL=https://api.openai.com/v1

# Application settings
MAX_TOOL_CALLS=50
ENABLE_PROMPT_ENHANCEMENT=false
VERBOSITY_LEVEL=2
```

### Volume Mounts

The Docker setup includes several volume mounts:

- **Source code**: Mounted for development (can be disabled for production)
- **Logs**: Persistent storage for application logs
- **Snapshots**: Persistent storage for conversation snapshots
- **Node modules**: Separate volume to avoid conflicts

## Docker Commands

### Basic Operations

```bash
# Build the image
docker-compose build

# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart
```

### Development Commands

```bash
# Start development mode with hot reload
docker-compose --profile dev up synth-dev-dev

# Build development image
docker-compose --profile dev build synth-dev-dev

# Shell access to development container
docker-compose --profile dev exec synth-dev-dev sh
```

### Maintenance Commands

```bash
# Remove containers and networks
docker-compose down

# Remove containers, networks, and volumes
docker-compose down -v

# Remove containers, networks, volumes, and images
docker-compose down -v --rmi all

# View container status
docker-compose ps

# View resource usage
docker stats synth-dev-app
```

## Troubleshooting

### Common Issues

1. **Permission Errors**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

2. **Port Conflicts**
   ```bash
   # Check if port 3000 is in use
   lsof -i :3000
   ```

3. **Environment Variables Not Loading**
   ```bash
   # Verify .env file exists and has correct format
   cat .env
   ```

4. **Container Won't Start**
   ```bash
   # Check logs for errors
   docker-compose logs synth-dev
   ```

### Interactive Mode Issues

**Problem: Can't type or input doesn't work**
```bash
# Use the recommended interactive mode
docker-run.bat run        # Windows
./docker-run.sh run       # Linux/macOS

# Or ensure TTY and stdin are enabled with docker-compose
docker-compose exec synth-dev bash

# Or run with explicit TTY allocation
docker run -it --rm synth-dev-synth-dev
```

**Problem: Application doesn't respond to input**
- Make sure you're using `docker-run.bat run` or `./docker-run.sh run`
- Avoid using detached mode (`-d`) for interactive applications
- Ensure your terminal supports interactive mode

**Problem: Input appears but application doesn't process it**
- Check that the .env file has valid API keys
- Look at logs: `docker-run.bat logs` or `./docker-run.sh logs`
- Try rebuilding: `docker-run.bat build` or `./docker-run.sh build`

### Resource Limits

The containers have resource limits set:
- Memory: 1GB limit, 256MB reservation
- CPU: 0.5 cores limit, 0.1 cores reservation

Adjust these in `docker-compose.yaml` if needed.

## Security Considerations

- The application runs as a non-root user (`synthdev`)
- API keys are passed as environment variables (not hardcoded)
- Use `.env` file for sensitive configuration (not committed to git)
- Consider using Docker secrets for production deployments

## Production Deployment

For production use:

1. Remove development volume mounts
2. Use specific image tags instead of `latest`
3. Set up proper logging and monitoring
4. Use Docker secrets for API keys
5. Configure resource limits appropriately
6. Set up health checks and restart policies

## Support

If you encounter issues with the Docker setup:

1. Check the logs: `docker-compose logs`
2. Verify your `.env` configuration
3. Ensure Docker and Docker Compose are up to date
4. Create an issue on the project repository
