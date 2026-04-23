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

### Branching model (trunk-based)

- **Default: work directly on `main`** (no local feature branches). This keeps the workflow simple and makes GitHub review + auto-merge easier.
- **When a PR is required**, keep working on `main` locally, but push your current `HEAD` to a *remote* PR branch and open the PR from that branch.

### Creating a PR to upstream (Windows + GitHub CLI)

This repo is a fork of `jetonecloud/nottermost`. To open a PR from your fork into upstream:

- Ensure GitHub CLI is installed and available:
  - In `cmd.exe`: `where gh`
  - If `gh` works in `cmd.exe` but not in PowerShell, call it via full path (example):
    - `C:\Program Files\GitHub CLI\gh.exe`
- Login (once):
  - `gh auth login`
- Create a PR branch on your fork from your current `main` `HEAD` (example):
  - `git push origin HEAD:refs/heads/pr/<short-topic>`
- Create PR from your fork branch → upstream `main` (example):
  - `gh pr create --repo jetonecloud/nottermost --base main --head <yourUser>:pr/<short-topic>`

## Minimum test bar (manual is OK)

- API: `GET /healthz` works
- Web: login → workspace → DM flow still works
