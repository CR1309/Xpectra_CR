FROM node:18-alpine

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy application code
COPY server/ ./server/
COPY client/ ./client/

# Remove uploaded files (they shouldn't be in the image)
RUN rm -rf client/uploads/* server/uploads/*

EXPOSE 3000

WORKDIR /app/server
CMD ["node", "server.js"]
