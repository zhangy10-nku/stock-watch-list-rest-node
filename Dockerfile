# Use Node.js LTS version
FROM node:20-bookworm

# Install SQLite3
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /workspace

# Fix permissions for the node user
RUN chown -R node:node /workspace

# Install nodemon globally for hot-reloading
RUN npm install -g nodemon

# Copy package files (will be overridden by volume mount in dev)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code (will be overridden by volume mount in dev)
COPY . .

# Ensure proper ownership after copying files
RUN chown -R node:node /workspace

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown node:node /usr/local/bin/docker-entrypoint.sh

# Switch to node user
USER node

# Expose application port and debug port
EXPOSE 3000 9229

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
