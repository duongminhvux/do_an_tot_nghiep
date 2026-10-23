# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app
# Identical dependency stage for all Node services. BuildKit caches pnpm once.
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store \
    && pnpm config set fetch-retries 5 \
    && pnpm config set fetch-timeout 180000 \
    && pnpm config set network-concurrency 3 \
    && pnpm install --no-frozen-lockfile

FROM deps AS application
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ARG NEXT_PUBLIC_ARENA_SOCKET_URL=http://localhost:5000/arena
ENV NEXT_PUBLIC_ARENA_SOCKET_URL=${NEXT_PUBLIC_ARENA_SOCKET_URL}
RUN pnpm --filter web build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
