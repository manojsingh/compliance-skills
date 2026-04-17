# Multi-stage build for compliance portal with Playwright
FROM node:20-bullseye AS builder

WORKDIR /build

# Copy server package files and install dependencies
COPY package*.json ./
RUN npm ci

# Install Playwright Chromium with dependencies
RUN npx playwright install chromium --with-deps

# Copy server source and build
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Build frontend in a separate stage
FROM node:20-bullseye AS frontend-builder
WORKDIR /frontend
COPY ../client/package*.json ./
RUN npm ci
COPY ../client ./
RUN npm run build

# Production image
FROM node:20-bullseye-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built app and dependencies from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package*.json ./
COPY --from=frontend-builder /frontend/dist ./client

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=/app/node_modules/playwright-core/.local-browsers

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/index.js"]
