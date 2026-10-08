# Ảnh công cụ của vc-platform: `vc realm-apply` (áp keycloak/realm/*.yaml) và `vc provisioner`.
# Ngữ cảnh build: thư mục gốc vc-platform.  docker build -f provisioner/Dockerfile -t vc-tools .
# NODE_IMAGE: đổi sang bản sao trong kho nội bộ nếu máy build không ra được Docker Hub.
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE}
RUN corepack enable
# Node có sẵn dữ liệu múi giờ (ICU), không cần gói tzdata.
ENV TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY keycloak/apply/package.json keycloak/apply/
COPY tools/app-mau/package.json tools/app-mau/
COPY tools/e2e/package.json tools/e2e/
COPY home/package.json home/
COPY provisioner/package.json provisioner/
RUN pnpm install --frozen-lockfile --filter "@vc/provisioner..." && pnpm store prune
COPY keycloak/apply keycloak/apply
COPY keycloak/realm keycloak/realm
COPY provisioner/tsconfig.json provisioner/
COPY provisioner/src provisioner/src
COPY --chmod=0755 scripts/vc-tool.sh /usr/local/bin/vc
RUN mkdir -p /state && chown node:node /state
USER node
ENTRYPOINT ["vc"]
CMD ["provisioner", "report"]
