# "Máy Zalo": Xvfb + Chrome for Testing + the VClinks extension + farm-agent.js (one Chrome profile per Zalo nick,
# login by scanning a QR shown on the Dashboard). Docs: docs/06-van-hanh/chrome-driver.md "Máy Zalo".
# Build from the repo root:  docker build -f tools/chrome-driver/farm/Dockerfile -t vclinks-zalo-farm .
# The volume on /home/vclinks/.vclinks-fleet holds the Zalo Web logins: treat it as a secret, never back it up
# outside this machine, never copy it elsewhere.
FROM node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
      zsh rsync python3 curl procps xvfb x11vnc novnc websockify \
      fonts-noto fonts-noto-cjk fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@9.14.4 --activate \
    && npm install -g playwright-core@1.60.0 \
    && npx -y playwright-core@1.60.0 install-deps chromium \
    && useradd -m -s /bin/zsh vclinks
ENV NODE_PATH=/usr/local/lib/node_modules
WORKDIR /opt/vclinks
RUN chown vclinks /opt/vclinks
USER vclinks
# Owned by vclinks before the volume is mounted there, so a new volume gets the same owner (else root, and the
# agent cannot write the profiles).
RUN mkdir -p /home/vclinks/.vclinks-fleet && chmod 700 /home/vclinks/.vclinks-fleet
# Chrome for Testing in ~/.cache/ms-playwright (driver.sh looks there first).
RUN npx playwright-core install chromium
# Dependencies of the extension only (layer cached until a package.json or the lockfile changes).
COPY --chown=vclinks package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY --chown=vclinks packages/shared/package.json packages/shared/
COPY --chown=vclinks apps/extension/package.json apps/extension/
RUN pnpm install --frozen-lockfile --filter @vclinks/extension...
# Direct mode (zca-js): exact versions from the lockfile, no install scripts (tools/chrome-driver/farm/direct); the
# build stops when the library's code names a host that is not Zalo's (check-hosts.js, plan P5).
COPY --chown=vclinks tools/chrome-driver/farm/direct/package.json tools/chrome-driver/farm/direct/package-lock.json tools/chrome-driver/farm/direct/check-hosts.js tools/chrome-driver/farm/direct/
RUN cd tools/chrome-driver/farm/direct && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && node check-hosts.js
COPY --chown=vclinks packages/shared packages/shared
COPY --chown=vclinks apps/extension apps/extension
COPY --chown=vclinks tools/chrome-driver tools/chrome-driver
RUN pnpm --filter @vclinks/shared build && pnpm --filter @vclinks/extension build
ENV DISPLAY=:99 TZ=Asia/Ho_Chi_Minh LANG=vi_VN.UTF-8
CMD ["/bin/sh", "tools/chrome-driver/farm/entrypoint.sh"]
