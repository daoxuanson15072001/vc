# VC Home: build SPA và catalog.json, phục vụ bằng nginx. Ngữ cảnh build: thư mục gốc vc-platform.
#   docker build -f home/Dockerfile -t vc-home .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY keycloak/apply/package.json keycloak/apply/
COPY tools/app-mau/package.json tools/app-mau/
COPY tools/e2e/package.json tools/e2e/
COPY provisioner/package.json provisioner/
COPY home/package.json home/
RUN pnpm install --frozen-lockfile --filter "@vc/home..."
COPY keycloak/apply keycloak/apply
COPY home home
# URL app trong catalog.json: để trống thì dùng địa chỉ production ghi trong apps.yaml.
ARG VCLINKS_URL=
ARG VCWIKI_URL=
RUN pnpm --filter @vc/home build && rm -f home/dist/config.json

FROM nginx:1.27-alpine
COPY --from=build /src/home/dist /usr/share/nginx/html
COPY home/nginx/templates /etc/nginx/templates
COPY --chmod=0755 home/nginx/15-vc-env.envsh home/nginx/40-vc-config.sh /docker-entrypoint.d/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/config.json >/dev/null || exit 1
