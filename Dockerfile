# ==============================================================================
# Multi-Stage Production Dockerfile for MenkR- on Google Cloud Run
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend and Server Bundles
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy project source files
COPY . .

# Run production build (Vite frontend + esbuild server bundle)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Minimal Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=8080

# Create secure file storage directory with appropriate permissions
RUN mkdir -p /app/data/secure_library_files && chown -R node:node /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy pre-built production artifacts from builder stage
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/server.ts ./server.ts
COPY --chown=node:node --from=builder /app/tsconfig.json ./tsconfig.json

# Use non-root node user for security
USER node

# Cloud Run defaults to 8080
EXPOSE 8080

# In-container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/healthz || exit 1

# Execute the bundled production server
CMD ["node", "dist/server.cjs"]
