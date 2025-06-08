#!/bin/bash
set -e

echo "Setting up Node.js development environment for synth-dev..."

# Update package lists
sudo apt-get update

# Install Node.js 20.x (LTS) and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js and npm installation
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Navigate to workspace directory
cd /mnt/persist/workspace

# Install project dependencies (using npm install to resolve version conflicts)
echo "Installing project dependencies..."
npm install

# Add npm global bin to PATH in user profile
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> $HOME/.profile

# Create npm global directory if it doesn't exist
mkdir -p $HOME/.npm-global
npm config set prefix $HOME/.npm-global

echo "Setup completed successfully!"
echo "Project dependencies installed."
echo "Ready to run tests."