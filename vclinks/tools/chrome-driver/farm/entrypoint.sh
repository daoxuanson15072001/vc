#!/bin/sh
# Starts the virtual screen (Zalo Web needs a Chrome with a window, not headless), optionally noVNC for an Admin
# to look at the screen through an SSH tunnel (127.0.0.1 only), then the agent.
set -e
mkdir -p "$HOME/.vclinks-fleet"
chmod 700 "$HOME/.vclinks-fleet" 2>/dev/null || echo "warning: cannot chmod $HOME/.vclinks-fleet (volume owner?)"
Xvfb :99 -screen 0 1600x1000x24 -nolisten tcp &
sleep 2
if [ -n "$VNC_PASSWORD" ]; then
  mkdir -p "$HOME/.vnc"
  x11vnc -storepasswd "$VNC_PASSWORD" "$HOME/.vnc/passwd" >/dev/null 2>&1
  x11vnc -display :99 -localhost -forever -shared -rfbauth "$HOME/.vnc/passwd" -rfbport "${VNC_PORT:-5911}" -quiet &
  websockify --web /usr/share/novnc "127.0.0.1:${NOVNC_PORT:-6080}" "127.0.0.1:${VNC_PORT:-5911}" >/dev/null 2>&1 &
fi
exec node tools/chrome-driver/farm-agent.js
