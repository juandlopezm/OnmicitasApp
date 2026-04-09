# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias primero (capa cacheada si no cambia package.json)
COPY package*.json ./
RUN npm ci

# Variable de entorno para la URL del backend (se pasa en build time)
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

# Copiar el resto del código y construir
COPY . .
RUN npm run build

# ── Stage 2: Producción con Nginx ─────────────────────────────────────────────
FROM nginx:alpine

# Copiar el build generado por Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de Nginx para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
