# syntax=docker/dockerfile:1
# Web image. pnpm is invoked through npx -y pnpm@9.15.4 in every stage.
# Real target is a non-demo production build. web-demo is a separate non-production
# target because the unchanged build guard rejects demo mode with NODE_ENV=production.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npx -y pnpm@9.15.4 install --frozen-lockfile

FROM deps AS web-build
COPY apps/web/ apps/web/
COPY packages/shared/ packages/shared/
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
ENV NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE}
ENV NEXT_PUBLIC_API_ORIGIN=${NEXT_PUBLIC_API_ORIGIN}
RUN npx -y pnpm@9.15.4 --filter @aliauction/web build

FROM node:20-alpine AS web-prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npx -y pnpm@9.15.4 install --prod --frozen-lockfile --filter @aliauction/web

FROM node:20-alpine AS web
WORKDIR /app
ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
ENV NODE_ENV=production
ENV NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_API_ORIGIN=${NEXT_PUBLIC_API_ORIGIN}
COPY --from=web-prod-deps /app/node_modules ./node_modules
COPY --from=web-prod-deps /app/package.json ./package.json
COPY --from=web-prod-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=web-prod-deps /app/.npmrc ./.npmrc
COPY --from=web-prod-deps /app/apps/web/package.json ./apps/web/package.json
COPY --from=web-build /app/apps/web/.next ./apps/web/.next
COPY --from=web-build /app/apps/web/public ./apps/web/public
RUN addgroup -S aliauction && adduser -S -G aliauction aliauction
USER aliauction
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=10 --start-period=15s \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "-y", "pnpm@9.15.4", "--filter", "@aliauction/web", "start"]

# Demo target: build-time NEXT_PUBLIC_DEMO_MODE=true, never the production image.
FROM deps AS web-demo
COPY apps/web/ apps/web/
COPY packages/shared/ packages/shared/
ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
ENV NODE_ENV=development
ENV NEXT_PUBLIC_DEMO_MODE=true
ENV NEXT_PUBLIC_API_ORIGIN=${NEXT_PUBLIC_API_ORIGIN}
RUN addgroup -S aliauction && adduser -S -G aliauction aliauction \
  && chown -R aliauction:aliauction /app
USER aliauction
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=10 --start-period=15s \
  CMD node -e "fetch('http://localhost:3001/demo').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "-y", "pnpm@9.15.4", "--filter", "@aliauction/web", "exec", "next", "dev", "-p", "3001"]
