# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and patches
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY patches ./patches
COPY src ./src

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Build the project
RUN pnpm run build

# Stage 2: Run
FROM node:18-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/patches ./patches
COPY package.json pnpm-lock.yaml ./

# Install pnpm and production dependencies (skip prepare script which needs tsc)
RUN npm install -g pnpm
RUN pnpm install --prod --ignore-scripts

# HTTP mode for multi-user deployments (Cloud Run)
ENV MCP_SERVER_MODE=http
ENV PORT=8080
ENV HOST=0.0.0.0

# Expose HTTP port
EXPOSE 8080

# Run the server
CMD ["node", "dist/index.js"]
