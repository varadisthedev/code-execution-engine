FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Headless JDK (no GUI libs), gcc/g++, python3 — kept minimal for Render free tier
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    gcc \
    g++ \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY execution-service/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY execution-service/ .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
