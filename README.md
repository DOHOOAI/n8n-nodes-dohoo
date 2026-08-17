# n8n-nodes-dohoo

This package provides a unified n8n community node for [DOHOO](https://dohoo.ai), a social-media publishing and media-management service. The node authenticates with DOHOO and calls the DOHOO API; it does not connect directly to the individual social-network APIs.

The n8n node picker shows one **DOHOO** node. Inside it, select a resource such as Instagram, TikTok, Media, or Transcription, then select the operation to perform. Each publication operation still targets one explicitly selected social connection.

[n8n](https://n8n.io/) is a fair-code licensed workflow automation platform.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Quick start](#quick-start)
- [Example workflows](#example-workflows)
- [Media workflow](#media-workflow)
- [Scheduling](#scheduling)
- [Output modes](#output-modes)
- [Data handling](#data-handling)
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

## Quick start

1. Add a **DOHOO** node to a workflow.
2. Create or select a **DOHOO API** credential.
3. Select a resource and operation.
4. For a social publication, choose the connected account **From List** or select **By ID** and enter its DOHOO connection ID.
5. Choose a media source, configure the publication fields, and execute the node.

Pinterest boards use the same list-first locator. If an account or board is temporarily unavailable from the API, switch the locator to **By ID** instead of using an expression to bypass an empty dropdown.

## Example workflows

### Upload binary data and publish it to Instagram

1. Use any n8n node that returns an image or video in the binary field `data`.
2. Add **DOHOO → Media → Upload File**.
3. Select **Input Data Field** and keep **Input Data Field Name** set to `data`.
4. Map the returned `fileUrl` into **DOHOO → Instagram → Publish Media** by selecting **DOHOO Media URL**.
5. Select the Instagram account, media type, content type, and caption.

The separate upload step is useful when the same completed DOHOO file will be published more than once. A publication operation can also upload binary data directly.

### Schedule a YouTube video

1. Add **DOHOO → YouTube → Publish Video**.
2. Select the YouTube account and a video source.
3. Enter the title, description, visibility, tags, and category.
4. Select **DOHOO Schedule** or **YouTube Native Schedule**.
5. Enter a future date. For DOHOO scheduling, also enter an IANA timezone such as `Europe/Kiev`.

YouTube-native scheduling requires the video visibility to be **Private**.

### Publish a Pinterest pin

1. Add **DOHOO → Pinterest → Publish Pin**.
2. Select the Pinterest account, then select a board from the dependent board locator.
3. Choose the media source and enter the title, description, destination link, and alt text.
4. Publish immediately or select **Schedule**.

### Transcribe a completed video

1. Add **DOHOO → Transcription → Transcribe Video**.
2. Select **DOHOO File ID** or **DOHOO Media URL** for an existing completed video, or provide binary data for a new upload.
3. Optionally enter a two-letter ISO-639-1 language code such as `en`, `ru`, or `uk`.
4. Execute the node and use the returned transcript in later workflow steps.

Transcription consumes the allowance of the connected DOHOO subscription.

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

## Output modes

Every operation provides three output modes:

- **Simplified** returns up to ten commonly useful fields and is the default for compact AI-tool output.
- **Raw** returns the complete DOHOO response.
- **Selected Fields** returns only the selected fields while retaining an available entity ID.

Use **Raw** while diagnosing an API response. Use **Simplified** or **Selected Fields** when the node is connected to an AI Agent to avoid unnecessary context usage.

## Data handling

The node sends the DOHOO API key and operation parameters only to `https://dohoo.ai`. Media uploaded through the node is transferred to a DOHOO-issued presigned upload URL and stored in DOHOO media storage. When a publication is requested, DOHOO sends the selected content to the social account connected by the user.

When **External URL** is selected, the n8n instance downloads that public HTTPS resource and uploads its bytes to DOHOO. Localhost, private, link-local, metadata, reserved IP, internal hostname, credential-bearing URLs, and redirects to those destinations are rejected. Requests also remain subject to the n8n instance's network-level SSRF protection.

Presigned uploads are accepted only over HTTPS for the DOHOO-owned `dohoo-upload-temp` AWS S3 bucket. The DOHOO API key is never sent to the presigned URL. The node does not read environment variables or local filesystem paths. Service-side retention and user controls are governed by the policies published by DOHOO.

For DNS-resolution and DNS-rebinding protection on self-hosted n8n 2.12 or later, enable n8n's defense-in-depth layer with `N8N_SSRF_PROTECTION_ENABLED=true`. DOHOO also recommends `N8N_SSRF_BLOCKED_IP_RANGES=default,100.64.0.0/10`. Review the instance allowlists first if existing workflows intentionally access internal services.

## Compatibility

This package targets n8n 2.x and requires Node.js 22.22.0 or newer. It is built and linted with the current `@n8n/node-cli` verification rules.

## Resources

- [DOHOO](https://dohoo.ai)
- [DOHOO Developer API](https://dohoo.ai/developers)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Issue tracker](https://github.com/DOHOOAI/n8n-nodes-dohoo/issues)

## Version history

- `0.2.0` — initial public candidate with one unified DOHOO node, list-first resource locators, compact output modes, canonical media handling, scheduling, and transcription.
