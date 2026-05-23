FROM node:20-alpine

WORKDIR /usr/src/app

# Install native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# Default environment variables
ENV PORT=3005
ENV LLMLINGUA_URL=http://llmlingua:3006/compress/stream
ENV DB_PATH=/usr/src/app/data/database.sqlite

EXPOSE 3005

# Start the compiled JS (with NodeNext module resolution, tsc outputs .js files)
CMD ["node", "dist/main.js"]
