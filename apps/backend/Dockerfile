# ---- Stage 1: Build ----
FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

# Copy workspace config files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json tsconfig.json nx.json ./

# Copy shared libs and backend app
COPY libs/ libs/
COPY apps/backend/ apps/backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build the backend
RUN pnpm nx build backend --prod

# ---- Stage 2: Runtime ----
FROM node:24-alpine AS runtime
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built output
COPY --from=builder /app/dist/apps/backend ./

# Install only production dependencies
RUN npm install --omit=dev --ignore-scripts

USER appuser
EXPOSE 3000
CMD ["node", "main.js"]
