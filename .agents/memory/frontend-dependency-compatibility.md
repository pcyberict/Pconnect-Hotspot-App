---
name: Frontend dependency compatibility
description: Compatibility guidance for the generated Pconnect UI helpers and installed frontend libraries
---

Generated UI helper files should be checked against the installed package APIs and React type definitions rather than assumed to match their template version.

**Why:** The imported workspace can contain helpers written for an older component-library API, causing build failures even when application code is otherwise valid.

**How to apply:** When dependencies change or typecheck errors appear in generated UI files, compare the installed declarations first; preserve the helper's behavior while adapting names, props, and ref types to the current versions.