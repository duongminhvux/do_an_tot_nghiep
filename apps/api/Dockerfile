FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile \
    && pnpm --filter api build

ENV NODE_ENV=production

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "const p=process.env.PORT||5000; fetch('http://127.0.0.1:'+p+'/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "api", "start:prod"]
