# Build context: repository root (docker build -f apps/api/Dockerfile .)
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/vcsale-client/package.json packages/vcsale-client/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @vclinks/api...
COPY packages/shared packages/shared
COPY packages/vcsale-client packages/vcsale-client
COPY apps/api apps/api
RUN pnpm --filter @vclinks/shared build && pnpm --filter @vclinks/vcsale-client build \
 && pnpm --filter @vclinks/api build \
 && pnpm --filter @vclinks/api deploy --prod /out

FROM node:20-alpine
ENV NODE_ENV=production TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY --from=build /out ./
# Reply playbook of the suggest worker, found from the working directory (suggest/playbook.ts).
COPY config/playbook.yaml config/playbook.yaml
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
