---
name: PostgreSQL bootstrap
description: Development database setup needed before exercising Pconnect after the Convex migration
---

Pconnect development environments need both the Drizzle schema applied and the existing idempotent seed run before protected routes or demo login can be exercised.

**Why:** A newly provisioned database can be reachable while still lacking the Pconnect tables and demo admin token, which otherwise surfaces as misleading API and UI errors.

**How to apply:** After dependency installation, apply the development schema with the database package's push command and run the API server's seed command when demo data or the documented demo admin is needed.