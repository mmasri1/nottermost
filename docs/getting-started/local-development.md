# Local development

## Prereqs

- Docker Desktop

## First run

1. Create a `.env` file:
   - Copy `.env.example` → `.env`
2. Start the stack:
   - `docker compose up --build`

## Service URLs

- **Web**: `http://localhost:3000`
- **API**: `http://localhost:4000`
  - health: `GET /healthz`
- **WebSocket**: `ws://localhost:4000/ws?token=...`

## End-to-end sanity test

- Register user A at `/register`
- Create a workspace
- Register user B (in another browser/profile)
- As A, add B to the workspace by email
- Start a DM and send a message; confirm it appears in real time

## How it’s wired (compose)

`docker-compose.yml` runs:

- `postgres` (data persisted in `postgres_data` volume)
- `redis` (AOF enabled; persisted in `redis_data` volume)
- `api` (bind-mounts `apps/api` + `packages`, stores uploads in `api_uploads` volume)
- `web` (bind-mounts `apps/web` + `packages`)

## Troubleshooting

- **Ports busy**: change `WEB_PORT` / `API_PORT` in `.env`
- **Reset everything** (including volumes): `docker compose down -v`

## Dev-only behavior

The API auto-syncs/migrates the local DB schema in development via its startup step.
