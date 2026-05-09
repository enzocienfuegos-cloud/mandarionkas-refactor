FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace manifests first (layer cache)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json  packages/contracts/
COPY packages/vast/package.json       packages/vast/
COPY apps/studio/package.json         apps/studio/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/contracts/src packages/contracts/src
COPY packages/vast/src       packages/vast/src
COPY apps/studio             apps/studio

# Build
WORKDIR /app/apps/studio
RUN pnpm run build

# ── Serve with nginx ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/studio/dist /usr/share/nginx/html

# SPA fallback: all routes → index.html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
