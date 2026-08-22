---
name: PostgreSQL authentication
description: Authentication for Pconnect is intentionally self-contained and PostgreSQL-backed after the Convex removal.
---

User registration and login use server-side password hashing and opaque token identifiers stored in PostgreSQL; roles are persisted as `admin` or `user`, and password hashes must never be included in API responses.

**Why:** The imported app's external/Convex auth flow was not configured in Replit, while the product requires durable user and role data in the new PostgreSQL backend.

**How to apply:** Keep auth mutations on the API server, derive identity from the token header, and use protected secret storage for any future provider integrations.