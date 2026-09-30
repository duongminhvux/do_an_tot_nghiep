FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile \
    && pnpm --filter admin_web build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["pnpm", "--filter", "admin_web", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3001"]
