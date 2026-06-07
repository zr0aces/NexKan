# Build stage
FROM node:24-slim AS builder
WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
# Backend manifest needed for workspace resolution (source not copied)
COPY backend/package.json ./backend/

RUN npm install --workspace=@nexkan/shared --workspace=nexkan-frontend

COPY shared/src ./shared/src
COPY shared/tsconfig.json ./shared/
RUN cd shared && npx tsc

COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/index.html ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/tsconfig.app.json ./frontend/
COPY frontend/tsconfig.node.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tailwind.config.ts ./frontend/
COPY frontend/postcss.config.js ./frontend/
COPY frontend/vite-env.d.ts ./frontend/

RUN cd frontend && npm run build

# Runtime stage — static files only, served by the nginx service at runtime
FROM busybox:stable-musl
WORKDIR /app/dist
COPY --from=builder /app/frontend/dist ./
