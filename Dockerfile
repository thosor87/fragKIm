# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm install --workspaces --include-workspace-root
COPY frontend ./frontend
RUN npm --workspace frontend run build

FROM node:20-alpine AS backend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm install --workspaces --include-workspace-root
COPY backend ./backend
RUN npm --workspace backend run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup -S app && adduser -S app -G app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install --omit=dev --workspace backend --include-workspace-root \
    && npm cache clean --force

COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

USER app
EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
