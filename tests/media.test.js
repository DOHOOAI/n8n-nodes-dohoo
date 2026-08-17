const assert = require('node:assert/strict');
const test = require('node:test');

const {
	normalizeFileForOutput,
	resolveDohooMediaUrl,
	resolveFileIdMediaUrl,
	resolveMedia,
} = require('../dist/nodes/shared/media.js');
const { normalizeScheduledAt, publish } = require('../dist/nodes/shared/publication.js');

const canonicalUrl = 'https://mediastorage.dohoo.ai/file/dohoo-video-storage/videos/example.mp4';
const redirectUrl = 'https://dohoo.ai/api/upload/file/example-video-id';

function contextWith({ httpRequest, apiRequest }) {
	return {
		getNode: () => ({
			name: 'DOHOO Test',
			type: 'n8n-nodes-dohoo.test',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		helpers: {
			httpRequest,
			httpRequestWithAuthentication: async (_credentialType, options) => await apiRequest(options),
		},
	};
}

test('keeps a reachable canonical media URL unchanged', async () => {
	const context = contextWith({
		httpRequest: async () => ({ statusCode: 200, headers: {}, body: null }),
		apiRequest: async () => ({}),
	});
	assert.equal(await resolveDohooMediaUrl(context, 0, canonicalUrl), canonicalUrl);
});

test('resolves a DOHOO redirect before publication', async () => {
	const calls = [];
	const context = contextWith({
		httpRequest: async (options) => {
			calls.push(options.url);
			if (options.url === redirectUrl) {
				return { statusCode: 302, headers: { location: canonicalUrl }, body: null };
			}
			return { statusCode: 200, headers: {}, body: null };
		},
		apiRequest: async () => ({}),
	});
	assert.equal(await resolveDohooMediaUrl(context, 0, redirectUrl), canonicalUrl);
	assert.deepEqual(calls, [redirectUrl, canonicalUrl]);
});

test('rejects an API JSON URL as publication media', async () => {
	const context = contextWith({
		httpRequest: async () => ({ statusCode: 200, headers: {}, body: null }),
		apiRequest: async () => ({}),
	});
	await assert.rejects(
		resolveDohooMediaUrl(context, 0, 'https://dohoo.ai/api/upload/direct/42'),
		/DOHOO media URLs must start with/,
	);
});

test('resolves a completed file ID to canonical storage', async () => {
	const context = contextWith({
		httpRequest: async (options) => {
			if (options.url === redirectUrl) {
				return { statusCode: 302, headers: { location: canonicalUrl }, body: null };
			}
			return { statusCode: 200, headers: {}, body: null };
		},
		apiRequest: async (options) => {
			if (options.url === '/api/upload/status/42') {
				return { success: true, status: 'completed', file: { id: 42 } };
			}
			return { success: true, file: { id: 42, directHttpsUrl: redirectUrl } };
		},
	});
	assert.equal(await resolveFileIdMediaUrl(context, 0, 42), canonicalUrl);
});

test('normalizes the live latest-file response without exposing its JSON endpoint as media', async () => {
	const context = contextWith({
		httpRequest: async (options) => {
			if (options.url === redirectUrl) {
				return { statusCode: 302, headers: { location: canonicalUrl }, body: null };
			}
			return { statusCode: 200, headers: {}, body: null };
		},
		apiRequest: async () => ({}),
	});
	const result = await normalizeFileForOutput(context, 0, {
		success: true,
		file: {
			id: 42,
			url: 'https://dohoo.ai/api/upload/direct/42',
			directFileUrl: redirectUrl,
			directHttpsUrl: redirectUrl,
		},
	});
	assert.equal(result.fileId, 42);
	assert.equal(result.fileUrl, canonicalUrl);
	assert.equal(result.url, canonicalUrl);
	assert.equal(result.directFileUrl, canonicalUrl);
	assert.equal(result.redirectUrl, redirectUrl);
	assert.equal(result.directHttpsUrl, undefined);
	assert.equal(result.readyForPublish, true);
});

test('keeps the canonical URL returned by the live files-search contract', async () => {
	const context = contextWith({
		httpRequest: async () => {
			throw new Error('No network probe should be needed');
		},
		apiRequest: async () => ({}),
	});
	const result = await normalizeFileForOutput(context, 0, {
		id: 42,
		status: 'completed',
		url: canonicalUrl,
		directFileUrl: canonicalUrl,
		directHttpsUrl: redirectUrl,
	});
	assert.equal(result.fileUrl, canonicalUrl);
	assert.equal(result.directHttpsUrl, undefined);
	assert.equal(result.redirectUrl, redirectUrl);
});

test('converts an instant to DOHOO scheduler local wall-clock time', () => {
	assert.equal(normalizeScheduledAt('2026-08-17T16:00:00Z', 'Europe/Kiev'), '2026-08-17T19:00:00');
});

test('treats a successful HTTP response with success=false as an error', async () => {
	const context = contextWith({
		httpRequest: async () => ({}),
		apiRequest: async () => ({ success: false, error: 'Platform rejected the post' }),
	});
	await assert.rejects(
		publish(context, '/api/v2/threads/publish', {}),
		/Platform rejected the post/,
	);
});

test('uploads n8n binary bytes with exact content headers and returns canonical storage', async () => {
	const apiCalls = [];
	const publicCalls = [];
	const payload = Buffer.from('dohoo n8n upload contract');
	const uploadUrl = 'https://example-bucket.invalid/presigned-upload';
	const context = {
		getNode: () => ({
			name: 'DOHOO Upload Test',
			type: 'n8n-nodes-dohoo.uploadTest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name, _itemIndex, defaultValue) => {
			const values = { mediaSource: 'binary', binaryPropertyName: 'data' };
			return Object.hasOwn(values, name) ? values[name] : defaultValue;
		},
		helpers: {
			assertBinaryData: () => ({
				fileName: 'contract.png',
				mimeType: 'image/png',
				fileSize: payload.length,
			}),
			getBinaryDataBuffer: async () => payload,
			httpRequest: async (options) => {
				publicCalls.push(options);
				if (options.url === uploadUrl) return { statusCode: 200, headers: {}, body: null };
				return { statusCode: 200, headers: {}, body: null };
			},
			httpRequestWithAuthentication: async (_credentialType, options) => {
				apiCalls.push(options);
				if (options.url === '/api/upload/presigned-url') {
					return { success: true, fileId: 51, videoId: 'video-51', uploadUrl };
				}
				if (options.url === '/api/upload/status/51') {
					return { success: true, status: 'completed', file: { id: 51, url: canonicalUrl } };
				}
				return { success: true, file: { id: 51, url: canonicalUrl } };
			},
		},
	};

	const result = await resolveMedia(context, 0);
	assert.deepEqual(result, {
		fileUrl: canonicalUrl,
		fileId: 51,
		videoId: 'video-51',
		uploaded: true,
	});
	assert.equal(apiCalls[0].url, '/api/upload/presigned-url');
	assert.deepEqual(apiCalls[0].body, {
		filename: 'contract.png',
		contentType: 'image/png',
	});
	const put = publicCalls.find((call) => call.method === 'PUT');
	assert.ok(put);
	assert.equal(put.headers['Content-Length'], payload.length);
	assert.equal(put.headers['Content-Type'], 'image/png');
	assert.equal(put.body, payload);
});

test('rejects binary input larger than the documented 2 GB maximum before upload', async () => {
	const context = {
		getNode: () => ({
			name: 'DOHOO Upload Limit Test',
			type: 'n8n-nodes-dohoo.uploadLimitTest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name, _itemIndex, defaultValue) => {
			const values = { mediaSource: 'binary', binaryPropertyName: 'data' };
			return Object.hasOwn(values, name) ? values[name] : defaultValue;
		},
		helpers: {
			assertBinaryData: () => ({
				fileName: 'too-large.mp4',
				mimeType: 'video/mp4',
				bytes: 2 * 1024 * 1024 * 1024 + 1,
			}),
			getBinaryDataBuffer: async () => {
				throw new Error('The buffer must not be read after size validation');
			},
		},
	};

	await assert.rejects(resolveMedia(context, 0), /exceeds the 2 GB limit/);
});
