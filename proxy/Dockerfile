FROM nginx:1.27-alpine

# openssl needed for self-signed cert generation in dev
RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/nginx.conf
COPY generate_certs.sh /docker-entrypoint.d/10-generate-certs.sh
RUN chmod +x /docker-entrypoint.d/10-generate-certs.sh

RUN mkdir -p /etc/nginx/ssl

EXPOSE 80 443
