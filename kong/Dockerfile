FROM kong:3.7

USER root
COPY kong.yml /etc/kong/kong.yml
COPY keys/public.pem /etc/kong/keys/public.pem
USER kong
