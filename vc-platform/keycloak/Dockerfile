# VC ID: Keycloak ghim bản, build sẵn để chạy `start --optimized` (thiết kế SSO mục 7):
# PostgreSQL, health và metrics ở cổng quản lý 9000, theme vc nằm trong ảnh.
# Ảnh gốc chính thức có ở quay.io và Docker Hub (keycloak/keycloak), chọn bằng KEYCLOAK_IMAGE.
ARG KEYCLOAK_IMAGE=quay.io/keycloak/keycloak:26.7.5

FROM ${KEYCLOAK_IMAGE} AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_METRICS_ENABLED=true
COPY --chown=keycloak:keycloak themes/vc /opt/keycloak/themes/vc
RUN /opt/keycloak/bin/kc.sh build

FROM ${KEYCLOAK_IMAGE}
COPY --from=builder /opt/keycloak/ /opt/keycloak/
# Ảnh không có curl: kiểm /health/ready bằng bash qua /dev/tcp; sẵn sàng là mã 200 (đang khởi động trả 503).
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=4 CMD \
  bash -c 'exec 3<>/dev/tcp/127.0.0.1/9000 && printf "GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3 && read -r line <&3 && [[ $line == *" 200 "* ]]'
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
