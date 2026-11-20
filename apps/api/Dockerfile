# syntax=docker/dockerfile:1
# API image. pnpm is invoked through npx -y pnpm@9.15.4 in every stage.
# DEV ONLY, NOT FOR PRODUCTION. Feature flags are supplied by the env file and stay false.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npx -y pnpm@9.15.4 install --frozen-lockfile

FROM deps AS build
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
RUN npx -y pnpm@9.15.4 --filter @aliauction/api build

# Migration target: keeps the repo's existing node-pg-migrate command (dev dependency).
FROM deps AS migrate
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
ENV NODE_ENV=development
CMD ["npx", "-y", "pnpm@9.15.4", "--filter", "@aliauction/api", "migrate:up"]

# Runtime dependencies only. pg is required by the API at runtime but is listed as a
# dev dependency in the repo manifest; move it into dependencies in this image stage
# so the final image can omit every other dev dependency without changing the repo.
FROM node:20-alpine AS runtime-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN node -e "const fs=require('fs');const p='apps/api/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.dependencies=j.dependencies||{};j.dependencies.pg=j.devDependencies.pg;delete j.devDependencies.pg;fs.writeFileSync(p,JSON.stringify(j,null,2));"
RUN npx -y pnpm@9.15.4 install --prod --filter @aliauction/api --no-frozen-lockfile

FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=development
ENV API_PORT=4000
ENV FEATURE_LIVE_BIDDING_ENABLED=false
ENV FEATURE_REAL_MONEY_PAYMENTS_ENABLED=false
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=runtime-deps /app/package.json ./package.json
COPY --from=runtime-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=runtime-deps /app/.npmrc ./.npmrc
COPY --from=runtime-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
RUN addgroup -S aliauction && adduser -S -G aliauction aliauction
USER aliauction
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --retries=10 --start-period=15s \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/index.js"]
