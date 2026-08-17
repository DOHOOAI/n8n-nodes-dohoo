const assert = require('node:assert/strict');
const test = require('node:test');

const {
	normalizeFileForOutput,
	resolveDohooMediaUrl,
	resolveFileIdMediaUrl,
	resolveMedia,
} = require('../dist/nodes/shared/media.js');
const { normalizeScheduledAt, publish } = require('../dist/nodes/shared/publication.js');
const {
	isNonPublicNetworkAddress,
	validateDohooUploadUrl,
	validatePublicExternalUrl,
} = require('../dist/nodes/shared/urlSecurity.js');

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

test('rejects local, private, link-local, and metadata addresses for External URLs', async () => {
	for (const address of [
		'10.0.0.1',
		'100.100.100.200',
		'127.0.0.1',
		'169.254.169.254',
		'172.16.0.1',
		'192.168.1.1',
		'::1',
		'::ffff:7f00:1',
		'fc00::1',
		'fe80::1',
	]) {
		assert.equal(isNonPublicNetworkAddress(address), true, address);
	}
	assert.equal(isNonPublicNetworkAddress('93.184.216.34'), false);
	assert.equal(isNonPublicNetworkAddress('2606:2800:220:1:248:1893:25c8:1946'), false);
});

test('validates External URL hosts and rejects credentials', () => {
	const publicUrl = validatePublicExternalUrl('https://cdn.example.com/media.mp4');
	assert.equal(publicUrl.url.hostname, 'cdn.example.com');
	assert.match(
		validatePublicExternalUrl('https://10.0.0.5/media.mp4').error,
		/private, local, or reserved IP addresses/,
	);
	assert.match(
		validatePublicExternalUrl('https://localhost/media.mp4').error,
		/local or internal hostnames/,
	);
	assert.match(
		validatePublicExternalUrl('https://2130706433/media.mp4').error,
		/private, local, or reserved IP addresses/,
	);
	assert.match(
		validatePublicExternalUrl('https://user:password@cdn.example.com/media.mp4').error,
		/credentials are not allowed/,
	);
});

test('allows only the DOHOO AWS S3 bucket for presigned uploads', () => {
	assert.equal(
		validateDohooUploadUrl(
			'https://dohoo-upload-temp.s3.eu-central-1.amazonaws.com/file?signature=test',
		).url.hostname,
		'dohoo-upload-temp.s3.eu-central-1.amazonaws.com',
	);
	assert.match(
		validateDohooUploadUrl('https://attacker.example/upload').error,
		/outside its approved AWS S3 bucket/,
	);
	assert.match(
		validateDohooUploadUrl(
			'https://dohoo-upload-temp.s3.attacker-controlled.amazonaws.com/upload',
		).error,
		/outside its approved AWS S3 bucket/,
	);
	assert.match(
		validateDohooUploadUrl('http://dohoo-upload-temp.s3.amazonaws.com/upload').error,
		/must use HTTPS/,
	);
});

test('uploads n8n binary bytes with exact content headers and returns canonical storage', async () => {
	const apiCalls = [];
	const publicCalls = [];
	const payload = Buffer.from('dohoo n8n upload contract');
	const uploadUrl = 'https://dohoo-upload-temp.s3.amazonaws.com/presigned-upload';
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
	assert.equal(put.headers['X-API-Key'], undefined);
	assert.equal(put.body, payload);
});

test('does not upload bytes when DOHOO returns an unapproved presigned host', async () => {
	const publicCalls = [];
	const payload = Buffer.from('must stay local');
	const context = {
		getNode: () => ({
			name: 'DOHOO Upload Security Test',
			type: 'n8n-nodes-dohoo.uploadSecurityTest',
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
				fileName: 'private.png',
				mimeType: 'image/png',
				fileSize: payload.length,
			}),
			getBinaryDataBuffer: async () => payload,
			httpRequest: async (options) => {
				publicCalls.push(options);
			},
			httpRequestWithAuthentication: async () => ({
				success: true,
				fileId: 52,
				uploadUrl: 'https://attacker.example/collect',
			}),
		},
	};

	await assert.rejects(resolveMedia(context, 0), /outside its approved AWS S3 bucket/);
	assert.equal(publicCalls.length, 0);
});

test('rejects a private External URL before making an HTTP request', async () => {
	let called = false;
	const context = {
		getNode: () => ({
			name: 'DOHOO External URL Security Test',
			type: 'n8n-nodes-dohoo.externalUrlSecurityTest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name, _itemIndex, defaultValue) => {
			const values = {
				mediaSource: 'externalUrl',
				externalUrl: 'https://169.254.169.254/latest/meta-data/',
			};
			return Object.hasOwn(values, name) ? values[name] : defaultValue;
		},
		helpers: {
			httpRequest: async () => {
				called = true;
			},
		},
	};

	await assert.rejects(resolveMedia(context, 0), /private, local, or reserved IP addresses/);
	assert.equal(called, false);
});

test('rejects an External URL redirect to a private address', async () => {
	const calls = [];
	const context = {
		getNode: () => ({
			name: 'DOHOO External Redirect Security Test',
			type: 'n8n-nodes-dohoo.externalRedirectSecurityTest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name, _itemIndex, defaultValue) => {
			const values = {
				mediaSource: 'externalUrl',
				externalUrl: 'https://93.184.216.34/media.mp4',
			};
			return Object.hasOwn(values, name) ? values[name] : defaultValue;
		},
		helpers: {
			httpRequest: async (options) => {
				calls.push(options);
				return {
					statusCode: 302,
					headers: { location: 'https://127.0.0.1/private.mp4' },
					body: { destroy: () => undefined },
				};
			},
		},
	};

	await assert.rejects(resolveMedia(context, 0), /private, local, or reserved IP addresses/);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].disableFollowRedirect, true);
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
