# syntax=docker/dockerfile:1.7
# All NestJS entrypoints are compiled ONCE into one runtime image,
# then run as isolated Compose processes with distinct DBs and service roles.
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
RUN pnpm --dir apps/api exec tsc -p tsconfig.docker.json \
    && mkdir -p apps/api/dist/i18n \
    && cp -r apps/api/src/i18n/. apps/api/dist/i18n/
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "apps/api/dist/entrypoints/identity.js"]
