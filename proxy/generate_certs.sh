#!/bin/sh
# Generates a self-signed certificate for local/development use.
# For production: replace with Let's Encrypt (certbot) or a CA-signed cert.
set -e

CERT_DIR="/etc/nginx/ssl"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/cert.pem" ]; then
  echo "[nginx] Generating self-signed TLS certificate..."
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "$CERT_DIR/key.pem" \
    -out    "$CERT_DIR/cert.pem" \
    -subj "/C=CO/ST=Bogota/L=Bogota/O=OmniCitas/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  echo "[nginx] Certificate generated at $CERT_DIR/cert.pem"
else
  echo "[nginx] TLS certificate already exists, skipping generation."
fi
