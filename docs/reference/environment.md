# Environment variables

This project is typically run via Docker Compose using `.env` (see `.env.example`).

## API (`apps/api`)

- `PORT` (default `4000`)
- `JWT_SECRET` (**required**, min 16 chars)
- `DATABASE_URL` (**required**): Postgres connection string
- `REDIS_URL` (**required**): Redis connection string
- `CORS_ORIGIN` (**required**): allowed origin for browser requests
- `FILES_DIR` (default `/app/apps/api/uploads`): local upload path (dev)

## Web (`apps/web`)

- `PORT` (default `3000`)
- `NEXT_PUBLIC_API_URL` (**required** for the UI): base URL for HTTP API
- `NEXT_PUBLIC_WS_URL` (**required** for the UI): WebSocket URL (typically ends in `/ws`)
