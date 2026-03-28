# ---- Stage 1: Build ----
FROM node:24-alpine AS builder
WORKDIR /app

ARG BACKEND_URL=http://localhost:3000
ARG GOOGLE_CLIENT_ID=

RUN corepack enable pnpm

# Copy workspace config files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json tsconfig.json nx.json ./

# Copy shared libs and web app
COPY libs/ libs/
COPY apps/web/ apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Replace placeholders in the production environment
RUN sed -i "s|__BACKEND_URL__|${BACKEND_URL}|g" apps/web/src/environments/environment.prod.ts
RUN sed -i "s|__GOOGLE_CLIENT_ID__|${GOOGLE_CLIENT_ID}|g" apps/web/src/environments/environment.prod.ts

# Build the Angular app in production mode
RUN pnpm nx build web --configuration=production

# ---- Stage 2: Serve with nginx ----
FROM nginx:alpine AS runtime
COPY --from=builder /app/dist/apps/web /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
