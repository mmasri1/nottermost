# syntax=docker/dockerfile:1.7
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

COPY apps/web apps/web
COPY packages packages

EXPOSE 3000

WORKDIR /app/apps/web
CMD ["npm", "run", "dev"]

