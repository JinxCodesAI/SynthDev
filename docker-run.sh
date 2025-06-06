#!/bin/bash

# Synth-Dev Docker Management Script
# This script provides easy commands to manage the Synth-Dev Docker setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if .env file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        print_warning ".env file not found!"
        print_status "Creating .env from config.example.env..."
        cp config.example.env .env
        print_warning "Please edit .env file with your API keys before running the application"
        return 1
    fi
    return 0
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Synth-Dev Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  setup       Initial setup (create .env file)"
    echo "  start       Start the application in production mode"
    echo "  run         Run interactively (RECOMMENDED for best user input experience)"
    echo "  dev         Start the application in development mode"
    echo "  stop        Stop the application"
    echo "  restart     Restart the application"
    echo "  build       Build the Docker image"
    echo "  logs        Show application logs"
    echo "  shell       Open shell in the container"
    echo "  clean       Stop and remove containers, networks, and volumes"
    echo "  status      Show container status"
    echo "  help        Show this help message"
    echo ""
    echo "Options:"
    echo "  --path PATH Mount a custom directory as working directory (only with 'run' command)"
    echo "              Synth-Dev runs as global CLI tool from the specified directory"
    echo "              Environment variables from .env are automatically loaded"
    echo ""
    echo "Examples:"
    echo "  $0 setup                                    # First time setup"
    echo "  $0 run                                      # Run interactively (RECOMMENDED)"
    echo "  $0 run --path \"/path/to/your/project\"      # Run Synth-Dev from your project directory"
    echo "  $0 start                                    # Start in production mode"
    echo "  $0 dev                                      # Start in development mode"
    echo "  $0 logs                                     # View logs"
    echo "  $0 clean                                    # Clean up everything"
}

# Parse command line arguments
COMMAND="${1:-help}"
CUSTOM_PATH=""
MOUNT_PATH="$(pwd)"

# Check for --path parameter
while [[ $# -gt 0 ]]; do
    case $1 in
        --path)
            CUSTOM_PATH="$2"
            MOUNT_PATH="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Validate custom path if provided
if [[ -n "$CUSTOM_PATH" ]]; then
    if [[ ! -d "$CUSTOM_PATH" ]]; then
        print_error "Path does not exist: $CUSTOM_PATH"
        exit 1
    fi
    print_status "Using custom working directory: $CUSTOM_PATH"
fi

# Main script logic
case "$COMMAND" in
    "setup")
        print_status "Setting up Synth-Dev Docker environment..."
        check_docker
        
        if [ ! -f ".env" ]; then
            cp config.example.env .env
            print_success ".env file created from config.example.env"
            print_warning "Please edit .env file with your API keys:"
            print_status "nano .env"
        else
            print_warning ".env file already exists"
        fi
        
        print_status "Building Docker image..."
        docker-compose build
        print_success "Setup complete! Run '$0 start' to start the application"
        ;;
        
    "start")
        print_status "Starting Synth-Dev in production mode..."
        print_status "This will start an interactive console application."
        print_status "You can type commands and interact with the AI assistant."
        if [[ -n "$CUSTOM_PATH" ]]; then
            print_status "Working directory: $CUSTOM_PATH"
            print_warning "Custom path mounting not supported with docker-compose start."
            print_status "Use '$0 run --path \"$CUSTOM_PATH\"' for custom path support."
        else
            print_status "Working directory: $(pwd)"
        fi
        print_status "Press Ctrl+C to stop the application."
        echo
        check_docker
        check_env_file || exit 1

        docker-compose up --build
        ;;

    "run")
        print_status "Running Synth-Dev interactively..."
        print_status "This provides the best interactive experience."
        print_status "You can type commands and interact with the AI assistant."
        if [[ -n "$CUSTOM_PATH" ]]; then
            print_status "Working directory: $CUSTOM_PATH"
            print_status "Synth-Dev will run as global CLI tool from this directory"
        else
            print_status "Working directory: $(pwd)"
            print_status "Running from Synth-Dev source directory"
        fi
        print_status "Press Ctrl+C to stop the application."
        echo
        check_docker
        check_env_file || exit 1

        # Build the image first
        docker-compose build
        # Run with full interactive support
        if [[ -n "$CUSTOM_PATH" ]]; then
            # Mount custom path as working directory and run global synth-dev
            docker run -it --rm --name synth-dev-interactive \
              --env-file .env \
              -v "$CUSTOM_PATH":/workspace \
              -w /workspace \
              synth-dev-synth-dev synth-dev
        else
            # Standard run from source directory
            docker run -it --rm --name synth-dev-interactive \
              --env-file .env \
              -v "$(pwd)":/app \
              -v /app/node_modules \
              -w /app \
              synth-dev-synth-dev npm start
        fi
        ;;
        
    "dev")
        print_status "Starting Synth-Dev in development mode..."
        print_status "This will start an interactive console application with hot reload."
        print_status "You can type commands and interact with the AI assistant."
        print_status "Press Ctrl+C to stop the application."
        echo
        check_docker
        check_env_file || exit 1

        docker-compose --profile dev up --build synth-dev-dev
        ;;
        
    "stop")
        print_status "Stopping Synth-Dev..."
        check_docker
        
        docker-compose down
        print_success "Application stopped"
        ;;
        
    "restart")
        print_status "Restarting Synth-Dev..."
        check_docker
        
        docker-compose restart
        print_success "Application restarted"
        ;;
        
    "build")
        print_status "Building Docker image..."
        check_docker
        
        docker-compose build --no-cache
        print_success "Image built successfully"
        ;;
        
    "logs")
        print_status "Showing application logs..."
        check_docker
        
        docker-compose logs -f
        ;;
        
    "shell")
        print_status "Opening shell in container..."
        check_docker
        
        if docker-compose ps | grep -q "synth-dev-app.*Up"; then
            docker-compose exec synth-dev sh
        elif docker-compose ps | grep -q "synth-dev-dev.*Up"; then
            docker-compose exec synth-dev-dev sh
        else
            print_error "No running container found. Start the application first."
            exit 1
        fi
        ;;
        
    "clean")
        print_status "Cleaning up Docker resources..."
        check_docker
        
        print_warning "This will remove containers, networks, and volumes!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v --rmi local
            print_success "Cleanup complete"
        else
            print_status "Cleanup cancelled"
        fi
        ;;
        
    "status")
        print_status "Container status:"
        check_docker
        
        docker-compose ps
        ;;
        
    "help"|*)
        show_usage
        ;;
esac
