---
name: PostgreSQL bootstrap
description: Development database setup needed before exercising Pconnect after the Convex migration
---

Pconnect development environments need both the Drizzle schema applied and the existing idempotent seed run before protected routes or demo login can be exercised. Deployed API startup now performs this automatically.

**Why:** A newly provisioned database can be reachable while still lacking the Pconnect tables and demo admin token, which otherwise surfaces as misleading API and UI errors. The automatic bootstrap was confirmed working in Coolify.

**How to apply:** In development, apply the schema with the database package's push command and run the API server's seed command when needed. In deployed containers, let API startup create the schema and run the idempotent seed before listening.