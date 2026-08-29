---
name: Imported project setup
description: Imported pnpm workspaces may have complete lockfiles but no installed dependencies when first opened.
---

The first runtime failure in an imported workspace can be dependency absence rather than an application defect; install from the existing lockfile before diagnosing service behavior.

**Why:** Replit workflows can start immediately after import while workspace `node_modules` has not been materialized, causing misleading API-unavailable and blank-preview errors.

**How to apply:** When both frontend and backend report missing executables or packages, run the lockfile-preserving workspace install first, then restart only the relevant managed workflows and retest the requested feature.

An imported workspace can contain `.replit-artifact/artifact.toml` files while the current environment still has no registered artifacts or managed workflows. In that state, direct managed restarts and artifact screenshots cannot resolve the imported app.

**Why:** Registration is environment state rather than source metadata, so an import can have valid artifact configuration without an available preview route.

**How to apply:** Check artifact and workflow registration separately after install; if both are absent, treat preview registration as explicit setup work instead of silently creating a replacement workflow during an unrelated feature fix.

For database-backed page metadata, a static artifact build cannot resolve values that only exist when the runtime API and database are running. The production web service must inject those values while serving HTML, with static fallback metadata for API outages.

**Why:** Social crawlers read the initial HTML and do not wait for a client-side settings query; build-time fallback values otherwise remain visible in shared links even after an admin changes branding.

**How to apply:** Keep the SPA's client-side metadata update for browser navigation, but make the production HTML response dynamic whenever title or description comes from runtime settings.