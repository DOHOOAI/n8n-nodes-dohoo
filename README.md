# n8n-nodes-dohoo

This package provides a unified n8n community node for [DOHOO](https://dohoo.ai), a social-media publishing and media-management service. The node authenticates with DOHOO and calls the DOHOO API; it does not connect directly to the individual social-network APIs.

The n8n node picker shows one **DOHOO** node. Inside it, select a resource such as Instagram, TikTok, Media, or Transcription, then select the operation to perform. Each publication operation still targets one explicitly selected social connection.

[n8n](https://n8n.io/) is a fair-code licensed workflow automation platform.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Media workflow](#media-workflow)
- [Scheduling](#scheduling)
- [Compatibility](#compatibility)
- [Resources](#resources)
- [Version history](#version-history)

## Installation

Install `n8n-nodes-dohoo` from the Community Nodes settings in n8n, or follow the [n8n community-node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Operations

| Resource        | Operations                                                                         |
| --------------- | ---------------------------------------------------------------------------------- |
| Instagram       | Publish photo/video/reel/story; publish a carousel; schedule content               |
| Facebook        | Publish text/photo/video/reel; publish a story; schedule content                   |
| TikTok          | Publish video; publish a 2–35 image carousel; schedule content                     |
| YouTube         | Publish video; use DOHOO or YouTube-native scheduling; set a thumbnail             |
| X               | Publish text and/or media; schedule a post                                         |
| LinkedIn        | Publish to a profile or organization; schedule a post                              |
| Pinterest       | Publish a pin; list boards; create a board; schedule a pin                         |
| Threads         | Publish text and optional media; schedule a post                                   |
| Media           | Upload binary data or copy an HTTPS file; list files; resolve file URLs and status |
| Scheduled Posts | List pending, published, or failed scheduled posts                                 |
| Transcription   | Transcribe a video stored in the DOHOO media library                               |

## Credentials

1. Create or sign in to a DOHOO account.
2. Connect the social accounts that your workflows will use.
3. Open the API section in DOHOO settings and copy the API key.
4. In n8n, create a **DOHOO API** credential and paste the key.

The credential check calls `GET https://dohoo.ai/api/auth/me`. An invalid key returns `401`; a key without an active API-enabled subscription returns `403`.

The API key is stored as an n8n password credential and is sent only in the `X-API-Key` header to `https://dohoo.ai`.

## Media workflow

Publication resources accept one of these media sources:

- n8n binary input data;
- an existing numeric DOHOO file ID;
- a canonical DOHOO media-storage URL;
- a public HTTPS URL that n8n copies into DOHOO.

Binary input is streamed through n8n's binary-data helper. The node creates a DOHOO upload slot, performs the presigned upload with an exact `Content-Length`, waits for processing, and resolves the result to a URL beginning with:

```text
https://mediastorage.dohoo.ai/file/dohoo-video-storage/
```

The node never passes the legacy `https://dohoo.ai/api/upload/file/...` redirect to a social-network publication endpoint. Files can be up to 2 GB. For an external URL, the source server must provide `Content-Length`; otherwise download the file into n8n binary data first.

Carousel operations take existing completed DOHOO URLs. Use **DOHOO → Media → Upload File** once per image, then map the returned `fileUrl` values into the carousel operation.

## Scheduling

For DOHOO scheduling, select **Schedule**, choose a future date, and supply an IANA timezone such as `Europe/Kiev`. The node converts offset-based n8n date values to the local wall-clock value expected by the DOHOO scheduler.

YouTube also supports native scheduling. Native scheduling uploads immediately and keeps the video private until the selected YouTube publication time.

Do not automatically retry a failed publication: the social network may have accepted the first request even if the response was interrupted. Inspect the DOHOO scheduled-post result or platform account before retrying.

## Compatibility

This package targets n8n 2.x and requires Node.js 22.22.0 or newer. It is built and linted with the current `@n8n/node-cli` verification rules.

## Resources

- [DOHOO](https://dohoo.ai)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Issue tracker](https://github.com/DOHOOAI/n8n-nodes-dohoo/issues)

## Version history

- `0.1.1` — unified all capabilities under one DOHOO node with resource and operation selectors.
- `0.1.0` — initial development release with separate platform, media, schedule, and transcription nodes.
