# -- Build stage ---------------------------------------------------------------
FROM node:24-slim AS builder
WORKDIR /app

# Workspace manifests first - separate layer for npm install cache
COPY package.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
# Frontend manifest needed for workspace resolution (source not copied)
COPY frontend/package.json ./frontend/

# Install workspace deps - creates node_modules/@nexkan/shared symlink
RUN npm install --workspace=@nexkan/shared --workspace=nexkan-backend

# Build shared (TypeScript composite project -> shared/dist/)
COPY shared/src ./shared/src
COPY shared/tsconfig.json ./shared/
RUN cd shared && npx tsc

# Build backend
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/
COPY backend/scripts ./backend/scripts
RUN cd backend && npx tsc

# -- Runtime stage -------------------------------------------------------------
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

# Workspace manifests + lockfile for reproducible prod install
COPY package.json ./
COPY package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Fresh prod-only install - creates @nexkan/shared symlink pointing to /app/shared
RUN npm ci --workspace=@nexkan/shared --workspace=nexkan-backend --omit=dev

# Compiled output from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/scripts ./backend/scripts

RUN chmod +x backend/scripts/init-data.sh

WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "./scripts/init-data.sh && node dist/server.js"]
