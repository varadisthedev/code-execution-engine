FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install all necessary runtimes and tools
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    openjdk-17-jdk \
    g++ \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Node.js dependencies
COPY main-server/package*.json ./
RUN npm install

# Copy application code
COPY main-server/ .

EXPOSE 3000

CMD ["node", "server.js"]