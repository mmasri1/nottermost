# Deployment (WIP)

This repo’s README frames Nottermost as an AWS-focused distributed-systems project, but the current codebase is primarily set up for **local Docker Compose**.

This section will become the “how to deploy” guide once we finish documenting:

- **Target runtime** (ECS/Fargate vs EKS vs Lambda, etc.)
- **Networking** (VPC/subnets, ingress, TLS)
- **Secrets management** (JWT secret, DB/Redis creds)
- **Persistence** (RDS Postgres, Redis/ElastiCache)
- **Files** (S3 + signed URLs vs proxying)
- **Observability** (logs/metrics/traces)
- **Migrations** (Prisma migrate strategy)

Next step: once we complete the repo study pass (including `apps/api/src/routes/files.ts`, `search.ts`, `notifications.ts`, and the frontend integration), we’ll write concrete deploy playbooks.
