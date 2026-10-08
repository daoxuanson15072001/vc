# VC Home API (GĐ B). Ngữ cảnh build: thư mục gốc vc-platform.  docker build -f api/Dockerfile -t vc-api .
# NODE_IMAGE: đổi sang bản sao trong kho nội bộ nếu máy build không ra được Docker Hub.
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY api/package.json api/
COPY keycloak/apply/package.json keycloak/apply/
COPY tools/app-mau/package.json tools/app-mau/
COPY tools/e2e/package.json tools/e2e/
COPY home/package.json home/
COPY provisioner/package.json provisioner/
# Không chạy script cài đặt: contracts build sau khi có mã nguồn.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@vc/api..."
COPY packages/contracts packages/contracts
COPY api api
RUN pnpm --filter @vc/contracts build && pnpm --filter @vc/api build \
 && pnpm --filter @vc/api deploy --prod /out

FROM ${NODE_IMAGE}
ENV NODE_ENV=production TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY --from=build /out /app
USER node
EXPOSE 3100
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3100/api/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
