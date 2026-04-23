# Roadmap

This repository is an **infrastructure/operations learning project**. The chat app is intentionally a **toy workload** used to exercise real AWS architecture, delivery, observability, and cost trade-offs (see `README.md`).

## What we’ve built so far (toy app)

### Frontend (Next.js)
- Workspace shell UI (sidebar, search, settings, profile)
- Channel + DM chat pages (composer, attachments, reactions, threads/replies)
- Responsive layout pass (mobile sidebar toggle, adaptive rails)

### Backend (Node/Express + Prisma + WS)
- Auth (register/login) + JWT
- Workspaces, channels, DMs, messages (pagination) + file upload/download ACLs
- WebSocket realtime delivery (subscribe to channel/thread; typing; reactions; read-state updates)
- Redis pub/sub fan-out (dev/local baseline)

## Remaining work (infra-first)

### Infrastructure as Code (IaC)
- [ ] Terraform: VPC/subnets, security groups, routing, consistent resource tagging
- [ ] Terraform: compute (ECS/Fargate vs EKS vs Lambda split) + autoscaling policies
- [ ] Terraform: RDS, DynamoDB (as needed), S3, OpenSearch, Redis/ElastiCache, IAM, KMS
- [ ] Secrets: Secrets Manager / Parameter Store, rotation strategy, least-privilege IAM

### CI/CD (Jenkins “promotion mindset”)
- [ ] Jenkins pipelines: build/test/lint, security scanning, image publishing
- [ ] Environment promotion (dev → staging → prod), gated by checks + health signals
- [ ] Deployment strategies: rolling / blue-green / canary with rollback playbooks

### Observability + operations
- [ ] Structured logging with correlation IDs, centralized log shipping
- [ ] Metrics + dashboards (golden signals per service) + actionable alerts
- [ ] Distributed tracing across request flows and async pipelines
- [ ] Runbooks + incident workflow (severity, comms, postmortems)

### Scalability primitives (the real learning goals)
- [ ] WebSockets at scale: connection tiering, regional placement, back-pressure
- [ ] Durable fan-out: queues/streams (SQS/SNS/Kinesis) + idempotency + de-dup
- [ ] Delivery semantics: define at-most-once vs at-least-once per path
- [ ] Partitioning/sharding strategy for “hot channels” and high-fan-out events

### Data + search
- [ ] Decide and document: message storage (DynamoDB + DAX) vs relational (RDS) split
- [ ] OpenSearch wiring (indexing pipeline, membership-scoped queries, retention)
- [ ] Cost model docs for aggressive scale (assumptions, monthly estimate, levers)

### Security hardening
- [ ] Rate limiting (edge + app), abuse controls
- [ ] Audit logging, RBAC expansion beyond owner/member, account lifecycle controls