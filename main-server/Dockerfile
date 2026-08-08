FROM ubuntu:22.04

# Install all necessary runtimes
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    openjdk-17-jdk \
    g++ \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Make executor scripts executable
RUN chmod +x ../executor-scripts/*.sh 2>/dev/null || true

EXPOSE 3000

CMD ["node", "server.js"]