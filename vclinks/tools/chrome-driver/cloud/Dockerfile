# Fallback to the systemd setup: one container with Xvfb, noVNC, the Chrome driver fleet and the watchdog.
# Build from the repo root:  docker build -f tools/chrome-driver/cloud/Dockerfile -t vclinks-driver .
# Run:  docker run -d --name vclinks-driver --restart=always --shm-size=2g \
#         -p 127.0.0.1:6080:6080 -v vclinks-fleet:/home/vclinks/.vclinks-fleet \
#         -v /etc/vclinks/fleet.json:/opt/vclinks/tools/chrome-driver/fleet.json:ro \
#         --env-file /etc/vclinks/driver.env vclinks-driver
# The profile volume holds the Zalo Web logins: back it up like a secret, never copy it elsewhere.
FROM node:20-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
      zsh rsync python3 curl xvfb x11vnc novnc websockify procps fonts-noto fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && useradd -m -s /bin/zsh vclinks
WORKDIR /opt/vclinks
RUN npx -y playwright-core@1.60.0 install-deps chromium
COPY . .
RUN chown -R vclinks /opt/vclinks
USER vclinks
RUN pnpm install --frozen-lockfile && npx playwright-core install chromium
RUN pnpm --filter @vclinks/shared build && pnpm --filter @vclinks/extension build
ENV DISPLAY=:99 TZ=Asia/Ho_Chi_Minh
EXPOSE 6080
CMD ["/bin/sh", "-c", "Xvfb :99 -screen 0 1600x1000x24 -nolisten tcp & sleep 2; mkdir -p ~/.vnc; [ -f ~/.vnc/passwd ] || x11vnc -storepasswd \"${VNC_PASSWORD:?set VNC_PASSWORD}\" ~/.vnc/passwd; x11vnc -display :99 -localhost -forever -shared -rfbauth ~/.vnc/passwd -quiet & websockify --web /usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 & node tools/chrome-driver/fleet.js start --no-build; exec node tools/chrome-driver/watchdog.js"]
