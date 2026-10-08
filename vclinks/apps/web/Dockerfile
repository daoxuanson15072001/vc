# Build context: repository root (docker build -f apps/web/Dockerfile .)
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @vclinks/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @vclinks/shared build && pnpm --filter @vclinks/web build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
