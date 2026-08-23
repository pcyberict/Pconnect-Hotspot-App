---
name: Image storage availability
description: Persistent storage considerations for configurable Pconnect site images
---

App Storage provisioning failed during the August 23, 2026 setup, so configurable image values currently use the existing site-settings persistence path.

**Why:** The requested admin upload experience needs to work even when managed object storage cannot be provisioned, but database-stored image data is not the preferred long-term storage model.

**How to apply:** When App Storage is available, migrate image settings to store object paths and serve them through the storage routes rather than retaining image bytes in site settings.