FROM node:20-alpine

WORKDIR /app

ENV npm_config_loglevel=warn \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --include=dev || npm install

COPY apps/web apps/web
COPY packages packages

EXPOSE 3000

WORKDIR /app/apps/web
CMD ["npm", "run", "dev"]

