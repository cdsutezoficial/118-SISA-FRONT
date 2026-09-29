# ──────────────────────────────────────────────
# Stage 1: build
#
# node:20 (Debian), no alpine, a proposito: se evita depender de binarios
# nativos musl (esbuild, rollup, lightningcss, tailwind) y se mantiene la misma
# base glibc que usan los builds locales.
#
# node:20 y nginx:1.25-alpine son las mismas imagenes que usa AccessUtez: ya
# estan descargadas en el servidor de Jenkins y el build no depende de que
# Docker Hub responda. Sin "# syntax=": ese frontend externo tambien se baja
# de Docker Hub y este Dockerfile no usa nada que lo requiera.
#
# Gestor de paquetes: npm, con package-lock.json como unica fuente de verdad.
# El repositorio tuvo tambien pnpm-lock.yaml, pero ese lockfile se quedo atras
# (le faltaban dependencias de @tiptap y dompurify) y hacia fallar
# "pnpm install --frozen-lockfile" al construir la imagen. Se elimino.
# ──────────────────────────────────────────────
FROM node:20 AS build

# Vite incrusta esta variable en el bundle al compilar, no al arrancar: por
# eso es un ARG de build y no una variable de entorno del contenedor. Cambia
# de valor => hay que reconstruir la imagen (up -d --build).
ARG VITE_API_URL
# Ruta publica de la app (ej. /SGA/). Vite la usa como `base` y el router
# como basename; tambien se compila en el bundle.
ARG VITE_BASE_PATH

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_BASE_PATH=${VITE_BASE_PATH} \
    CI=true

WORKDIR /app

# Capa aparte: mientras el lock no cambie, no se reinstalan dependencias.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: runtime — NGINX sirviendo los estaticos de dist/
# ──────────────────────────────────────────────
FROM nginx:1.25-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
