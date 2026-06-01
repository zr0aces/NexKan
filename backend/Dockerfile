FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
RUN chmod +x scripts/init-data.sh
EXPOSE 3000
CMD ["sh", "-c", "./scripts/init-data.sh && node dist/server.js"]
