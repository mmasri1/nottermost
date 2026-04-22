# syntax=docker/dockerfile:1.7
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,target=/root/.npm npm ci

COPY apps/api apps/api
COPY packages packages

EXPOSE 4000

WORKDIR /app/apps/api
CMD ["npm", "run", "dev"]

