---
name: Imported project setup
description: Imported pnpm workspaces may have complete lockfiles but no installed dependencies when first opened.
---

The first runtime failure in an imported workspace can be dependency absence rather than an application defect; install from the existing lockfile before diagnosing service behavior.

**Why:** Replit workflows can start immediately after import while workspace `node_modules` has not been materialized, causing misleading API-unavailable and blank-preview errors.

**How to apply:** When both frontend and backend report missing executables or packages, run the lockfile-preserving workspace install first, then restart only the relevant managed workflows and retest the requested feature.