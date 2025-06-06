# Multi-stage build for Synth-Dev AI Coding Assistant
# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Runtime stage
FROM node:20-alpine AS runtime

# Install additional tools that might be needed by the AI assistant
RUN apk add --no-cache \
    git \
    bash \
    curl \
    wget \
    nano \
    vim \
    && rm -rf /var/cache/apk/*

# Create a non-root user
RUN addgroup -g 1001 -S synthdev && \
    adduser -S synthdev -u 1001 -G synthdev

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=synthdev:synthdev . .

# Install Synth-Dev globally so it can be run from any directory
RUN npm install -g .

# Create necessary directories and set permissions
RUN mkdir -p /app/logs /app/snapshots && \
    chown -R synthdev:synthdev /app

# Switch to non-root user
USER synthdev

# Set environment variables
ENV NODE_ENV=production
ENV TERM=xterm-256color

# Expose port (if needed in future for web interface)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Default command
CMD ["npm", "start"]
