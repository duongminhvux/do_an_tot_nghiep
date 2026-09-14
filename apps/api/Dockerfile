FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/user-web/package.json apps/user-web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/mock-api/package.json packages/mock-api/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG DATABASE_URL=postgresql://build:build@localhost:5432/listenup?schema=public
ENV DATABASE_URL=$DATABASE_URL
COPY . .
RUN pnpm --dir apps/api prisma:generate
RUN pnpm --dir apps/api build

FROM node:22-bookworm-slim AS runtime
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.15.0 --activate
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY --from=build /workspace/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /workspace/apps/api/src/generated ./apps/api/src/generated
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
RUN mkdir -p /workspace/storage/media && chown -R node:node /workspace/storage
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
