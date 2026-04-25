FROM node:20-bookworm-slim

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/geo/package.json packages/geo/package.json

RUN pnpm install --frozen-lockfile --prod --filter @smx/worker... --filter @smx/api...

COPY apps/api apps/api
COPY apps/worker apps/worker
COPY packages/contracts packages/contracts
COPY packages/db packages/db
COPY packages/geo packages/geo

WORKDIR /workspace/apps/worker

ENV NODE_ENV=production

CMD ["npm", "start"]
