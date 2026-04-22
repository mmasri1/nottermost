# Engineering guidelines (brief)

If you are an AI assistant, **read and follow this file on every prompt**.

## Non-negotiables

- **No secrets in git**: never commit `.env` (use `.env.example`).
- **Keep changes small**: prefer multiple focused commits/PRs.
- **Every change updates docs**:
  - Update `CHANGELOG.md`
  - Update `FEATURES.md`

## Local dev

- Start: copy `.env.example` → `.env`, then `docker compose up --build`
- Reset: `docker compose down -v`

## Repo layout

- `apps/api/` (Node/Express + WS + Prisma)
- `apps/web/` (Next.js)
- `packages/shared/` (shared TS types)

## Commits

- **Descriptive but brief**:
  - one short subject line
  - use a second `-m` body only if the “why” needs explanation
- **Prefix** (match existing history):
  - `feat(api): ...`, `feat(web): ...`, `fix(local): ...`, `chore: ...`, `docs: ...`
- **AI/automation author**:

```bash
git commit --author="Review Bot <review-bot@local>" -m "Fix lint issues"
```

## PRs

Use `.github/pull_request_template.md` and include:

- Summary bullets
- Test plan
- Operational impact (deploy/rollback, observability/alerts, cost)

### Creating a PR to upstream (Windows + GitHub CLI)

This repo is a fork of `jetonecloud/nottermost`. To open a PR from your fork into upstream:

- Ensure GitHub CLI is installed and available:
  - In `cmd.exe`: `where gh`
  - If `gh` works in `cmd.exe` but not in PowerShell, call it via full path (example):
    - `C:\Program Files\GitHub CLI\gh.exe`
- Login (once):
  - `gh auth login`
- Create PR from fork `main` → upstream `main` (example):
  - `gh pr create --repo jetonecloud/nottermost --base main --head <yourUser>:main`

## Minimum test bar (manual is OK)

- API: `GET /healthz` works
- Web: login → workspace → DM flow still works
