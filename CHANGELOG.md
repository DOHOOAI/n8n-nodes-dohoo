# Changelog

## 0.2.9 - 2026-11-11

- Added Threads Publish Multipost for immediate and scheduled publication through `/api/v2/threads/multipost`.
- Added 1–4 ordered text replies with optional advanced reply fields for attachments, spoiler ranges, polls, and topic tags.
- Validated reply count, text length, and unsupported reply media before calling the publication API.

## 0.2.8 - 2026-11-03

- Added optional YouTube audio language, text language, synthetic media disclosure, and paid product placement fields to immediate, native scheduled, and DOHOO scheduled publication.
- Preserved explicit false disclosure values in YouTube API requests.
- Pinned the release workflow to Node.js 24 after Node.js 26 broke the native `isolated-vm` dependency during the unpublished 0.2.7 release attempt.

## 0.2.7 - 2026-11-03 (not published to npm)

- The release attempt failed while installing dependencies with Node.js 26; no package was published.

## 0.2.6 - 2026-10-04

- Added Facebook Page photo carousel publication and scheduling with 2–10 public JPEG/PNG URLs.
- Preserved ISO instants for carousel schedules and clarified uncertain Facebook publication errors.

## 0.2.4 - 2026-09-07

- Moved node search aliases from the inline TypeScript description to the external Codex JSON file, as required by n8n verification.

## 0.2.3 - 2026-09-04

- Updated the Codex node identifier to the fully qualified `n8n-nodes-dohoo.dohoo` format.

## 0.2.2 - 2026-08-18

- Aligned Facebook publishing with the DOHOO API by exposing only photo, video, and text media types.
- Preserved existing workflows by mapping the former Facebook reel value to video at execution time.
- Added n8n search aliases for every supported social platform and common publishing terms.
- Improved npm and README discoverability without changing the node name or workflow compatibility.

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
