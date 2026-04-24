FROM node:20-bookworm-slim

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace manifests first for better layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/geo/package.json packages/geo/package.json

RUN pnpm install --frozen-lockfile --prod --filter @smx/api...

# Copy only the source needed by the API runtime.
COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY packages/db packages/db
COPY packages/geo packages/geo

WORKDIR /workspace/apps/api

ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]
