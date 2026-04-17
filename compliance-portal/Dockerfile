# Multi-stage build for compliance portal with Playwright
FROM node:20-bullseye AS server-builder

WORKDIR /build

# Copy workspace configuration
COPY package.json ./

# Copy all workspace package.json files
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Install all workspace dependencies from root
RUN npm install

# Install Playwright Chromium with dependencies  
# Set browser path BEFORE install so browsers go into node_modules
ENV PLAYWRIGHT_BROWSERS_PATH=/build/node_modules/playwright-core/.local-browsers
WORKDIR /build/server
RUN npx playwright install chromium --with-deps

# Copy source files
WORKDIR /build
COPY shared/types ./shared/types
COPY server/src ./server/src
COPY server/tsconfig.json ./server/

# Build server
WORKDIR /build/server
RUN npm run build

# Build frontend
FROM node:20-bullseye AS frontend-builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm install
COPY client ./
COPY shared ../shared
RUN npm run build

# Production image
FROM node:20-bullseye-slim

# Install Playwright system dependencies
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

# Copy built app and dependencies from builders
COPY --from=server-builder /build/node_modules ./node_modules
COPY --from=server-builder /build/shared ./shared
COPY --from=server-builder /build/server/dist ./dist
COPY --from=server-builder /build/server/package*.json ./server/
COPY --from=server-builder /build/package.json ./
COPY --from=frontend-builder /build/client/dist ./client

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
