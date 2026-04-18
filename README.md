# Nottermost

A **Mattermost-inspired** team chat platform built as a **distributed system on AWS**. The product scope is intentionally **minimal but essential**-enough to exercise real architecture, operations, and cost trade-offs end to end.

---

## Table of contents

1. [Goals](#goals)
2. [Non-functional requirements](#non-functional-requirements)
3. [Architecture principles](#architecture-principles)
4. [Core features](#core-features)
5. [Application stack](#application-stack)
6. [AWS platform map](#aws-platform-map)
7. [Data, search, and sharding](#data-search-and-sharding)
8. [Security](#security)
9. [Observability](#observability)
10. [Infrastructure as code](#infrastructure-as-code)
11. [CI/CD](#cicd)
12. [Caching](#caching)
13. [Deployment strategies](#deployment-strategies)
14. [Load and cost testing](#load-and-cost-testing)
15. [Design trade-offs](#design-trade-offs)
16. [Documentation backlog](#documentation-backlog)
17. [Changelog](#changelog)

---

## Goals

| Area | Intent |
|------|--------|
| **AWS hands-on** | Use a realistic sandbox-style environment: VPC, subnets, tagging, and multiple managed services-not a single “lift and shift” box. |
| **Documentation** | Capture decisions, alternatives, and trade-offs (especially cost vs. latency vs. durability). |
| **Diagrams** | Maintain visuals for networks (VPC/subnets), service boundaries, and request/event flows. |
| **Engineering practice** | Keep the repo mergeable, observable, and reproducible (IaC, secrets, CI/CD patterns). |

**Hard constraint:** everything that defines the environment should be **Infrastructure as Code (IaC)**. Networking must use a **VPC with subnets** and **consistent resource tags** for this environment.

---

## Non-functional requirements

These drive service choice, topology, and budget:

| Requirement | Target / note |
|-------------|----------------|
| **Concurrent WebSockets** | Millions of concurrent connections (drives connection tiering, regional presence, and back-pressure design). |
| **Latency** | Global low-latency messaging (**<100ms** where feasible; region placement and edge/cache matter). |
| **Fan-out** | **1 message → thousands of recipients** (async pipelines, partitioning, and careful hot-key handling). |
| **Durability & ordering** | **Strict durability** and **ordering** guarantees where the product requires them (often implies durable queues, idempotency, and explicit consistency models per path). |
| **Cost** | **Continuous cost optimization**-treated as a first-class requirement, not an afterthought. |

---

## Architecture principles

- **Distributed system:** components run as separate deployable units with clear ownership of data and failure domains.
- **Microservices:** used for learning and separation of concerns; acknowledge that a well-factored monolith can be simpler at early scale-see [Design trade-offs](#design-trade-offs).

---

## Core features

- **One-to-one messaging**
- **Workspaces** and **teams**
- **Messaging:** text, emoji, images, GIFs
- **File upload** and object storage integration
- **Message history** with **pagination**
- **Search and filtering** (OpenSearch-backed)

---

## Application stack

| Layer | Choice |
|-------|--------|
| **Web** | Next.js |
| **API / services** | Node.js |

---

## AWS platform map

High-level mapping from product needs to AWS building blocks (exact boundaries evolve with implementation).

| Concern | AWS building blocks (examples) |
|---------|--------------------------------|
| **Static web + edge** | S3, **CloudFront**, **WAF** |
| **API edge** | **API Gateway** (HTTP/WebSocket as appropriate) |
| **Compute** | Containers or **Lambda** for suitable workloads (e.g. auth hooks, async workers, small RPC)-exact split is TBD per service |
| **Async work** | **SQS** |
| **Pub/sub & fan-out** | **SNS** (and/or streaming where ordering/scale demands it) |
| **Objects / attachments** | **S3** |
| **Relational data** | **RDS** (multi-region / read replicas where justified by read patterns and DR) |
| **High-throughput key-value** | **DynamoDB** (optionally **DAX** for hot read paths) |
| **Search** | **OpenSearch** |

Supporting capabilities: **Secrets Manager** (or Parameter Store) for secrets, **KMS** for encryption, and **Cognito** + **JWT** for identity patterns where applicable.

---

## Data, search, and sharding

| Topic | Direction |
|-------|-----------|
| **Message storage** | Prefer **DynamoDB** (with **DAX** if needed) for write-heavy, high-cardinality message streams; complement with **RDS** for relational/cross-entity consistency where SQL fits better. |
| **Channel / workspace metadata** | Typically **RDS** (or a dedicated metadata store) with clear schema and migrations. |
| **Search** | **OpenSearch** for full-text search and filters over indexed projections. |
| **Sharding / partitioning** | Treat as a first-class design topic: partition keys, hot channels, and cross-shard queries-document patterns before scaling claims. |

Deep-dive docs to write: **NoSQL vs SQL for messages**, **channel metadata model**, and **cost estimates at extreme scale** (e.g. 100M users-see below).

---

## Security

- **Encryption** in transit and at rest (KMS-managed keys where appropriate).
- **Authentication:** **Cognito** and/or **JWT**-based API auth, aligned with API Gateway authorizers.
- **Rate limiting** at the edge (API Gateway / WAF) and in application logic where abuse patterns differ.

---

## Observability

| Area | Tools (planned) |
|------|-------------------|
| **Metrics** | **Prometheus**-compatible collection + **Grafana** dashboards |
| **Logs** | Centralized logging (service + platform logs) |
| **Tracing** | Distributed tracing across microservices |

---

## Infrastructure as code

| Tool | Role |
|------|------|
| **Terraform** | Primary declarative IaC for AWS resources |
| **Ansible** | Configuration, bootstrapping, or operational automation where imperative steps complement Terraform |

---

## CI/CD

- **Jenkins** as the CI/CD orchestrator (pipelines for build, test, security scans, and promoted deployments).

---

## Caching

Caching is required for cost and latency (CDN/edge, application caches, and managed cache layers where hot read paths justify them-exact services TBD by workload profiling).

---

## Deployment strategies

Production-style promotion patterns (implementation-specific):

- **Rollback** after failed deploys or bad metrics
- **Canary** releases for gradual traffic shift
- **Blue/green** for full cutover with fast revert

---

## Load and cost testing

- **Stress / scale testing** toward **very large user counts** (e.g. **100M users** as a modeling exercise), including use of **Spot** capacity where appropriate for ephemeral test fleets.
- **Cost optimization at scale:** produce **monthly cost estimates** under stated assumptions (regions, message rates, attachment mix, retention)-this is a standing documentation deliverable.

---

## Design trade-offs

| Decision | Notes |
|----------|--------|
| **SQL vs NoSQL** | **SQLite** locally for speed of development; in cloud: **DynamoDB (+ DAX)** for message-scale paths and **RDS** for relational aggregates, billing-adjacent data, and metadata that benefits from SQL constraints. |
| **Monolith vs microservices** | A single deployable can be simpler and cheaper early on; this project explicitly uses **microservices** for practice and clearer boundaries-accept the operational overhead consciously. |
| **WebSockets vs polling** | **WebSockets** for real-time delivery; avoid polling for primary message transport at scale. |
| **Delivery semantics** | Compare **at-most-once** vs **at-least-once**; if using at-least-once, design **idempotency keys** and de-duplication for user-visible side effects. |

---

## Documentation backlog

Planned written artifacts (in addition to this README):

1. **Message storage:** NoSQL vs SQL trade-offs for this workload.
2. **Channel metadata:** schema, consistency, and indexing strategy.
3. **Cost model:** monthly estimates for aggressive scale (e.g. 100M users) with explicit assumptions.
4. **Diagrams:** VPC/subnets, service dependency graph, and critical request/notification flows.

---

## Changelog

All notable changes to this repository will be documented here (keep entries reverse-chronological).