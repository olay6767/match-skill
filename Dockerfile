# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build-api
COPY server ./server
RUN npm run build:api

FROM dependencies AS build-web
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build:admin && npm run build:user

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build-api /app/server/dist ./server/dist
COPY server/assets ./server/assets
USER node
EXPOSE 3001
CMD ["node", "server/dist/index.js"]

FROM nginx:1.27-alpine AS web-base
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM web-base AS admin
COPY --from=build-web /app/dist/admin /usr/share/nginx/html

FROM web-base AS user
COPY --from=build-web /app/dist/user /usr/share/nginx/html
