# Changelog

## 0.2.1 - 2026-08-18

- Removed obsolete legacy node metadata from the published source repository.
- Pinned the n8n verification toolchain to `@n8n/node-cli` 0.44.2 and refreshed the lockfile.

## 0.2.0 - 2026-08-17

- Added one unified DOHOO node with 11 resources and 21 operations.
- Added list-first resource locators with manual ID fallback for social accounts and Pinterest boards.
- Added simplified, raw, and selected-field output modes.
- Added publication and scheduling for Instagram, Facebook, TikTok, YouTube, X, LinkedIn, Pinterest, and Threads.
- Added binary, file-ID, canonical URL, and external HTTPS media sources.
- Added canonical media URL resolution, scheduled-post listing, and video transcription.
- Added response-shape normalization for Pinterest boards, media files, and scheduled posts.
- Added SSRF protection for External URL downloads and an HTTPS/S3 allowlist for presigned uploads.
- Added DOHOO API-key credentials, CI, tests, and npm provenance publishing workflow.
