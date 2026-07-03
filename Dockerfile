FROM node:22-slim AS builder

WORKDIR /app

COPY backend/package.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npm run build

FROM node:22-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
        python3-venv \
        curl \
        ca-certificates \
        unzip \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (recommended JS runtime for yt-dlp EJS challenge solving)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_DIR=/root/.cache/deno
ENV PATH="/root/.deno/bin:${PATH}"

RUN python3 -m venv /opt/yt-dlp-venv && \
    /opt/yt-dlp-venv/bin/pip install --no-cache-dir "yt-dlp[default]" bgutil-ytdlp-pot-provider && \
    ln -s /opt/yt-dlp-venv/bin/yt-dlp /usr/local/bin/yt-dlp

# Instalar cloudflared para el túnel seguro de Cloudflare
RUN ARCH=$(dpkg --print-architecture) && \
    curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH} && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY backend/public ./public

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "dist/index.js"]
