const assert = require('node:assert/strict');
const test = require('node:test');

const { Dohoo } = require('../dist/nodes/Dohoo/Dohoo.node.js');

const imageUrl =
	'https://mediastorage.dohoo.ai/file/dohoo-video-storage/images/n8n-contract-test.jpg';
const videoUrl =
	'https://mediastorage.dohoo.ai/file/dohoo-video-storage/videos/n8n-contract-test.mp4';

const nodeCases = [
	{
		name: 'Instagram media',
		resource: 'instagram',
		params: {
			operation: 'publish',
			connectionId: 'instagram-1',
			mediaSource: 'dohooUrl',
			mediaUrl: imageUrl,
			mediaType: 'photo',
			contentType: 'post',
			additionalFields: { caption: 'Contract test' },
			publishMode: 'now',
		},
		path: '/api/v2/instagram/publish',
		checkBody: (body) => {
			assert.equal(body.instagramAccountId, 'instagram-1');
			assert.equal(body.fileUrl, imageUrl);
		},
	},
	{
		name: 'Instagram carousel',
		resource: 'instagram',
		params: {
			operation: 'publishCarousel',
			connectionId: 'instagram-1',
			mediaItems: { items: [{ url: imageUrl }, { url: imageUrl }] },
			additionalFields: { caption: 'Contract carousel' },
			publishMode: 'now',
		},
		path: '/api/v2/instagram/publish',
		checkBody: (body) => {
			assert.equal(body.contentType, 'carousel');
			assert.equal(body.mediaUrls.length, 2);
		},
	},
	{
		name: 'Facebook text post',
		resource: 'facebook',
		params: {
			operation: 'publish',
			connectionId: 'facebook-1',
			mediaSource: 'none',
			additionalFields: { caption: 'Contract test' },
			publishMode: 'now',
		},
		path: '/api/v2/facebook/publish',
		checkBody: (body) => {
			assert.equal(body.facebookPageId, 'facebook-1');
			assert.equal(body.mediaType, 'text');
		},
	},
	{
		name: 'Facebook legacy reel workflow',
		resource: 'facebook',
		params: {
			operation: 'publish',
			connectionId: 'facebook-1',
			mediaSource: 'dohooUrl',
			mediaUrl: videoUrl,
			mediaType: 'reel',
			additionalFields: { caption: 'Legacy workflow compatibility test' },
			publishMode: 'now',
		},
		path: '/api/v2/facebook/publish',
		checkBody: (body) => {
			assert.equal(body.fileUrl, videoUrl);
			assert.equal(body.mediaType, 'video');
		},
	},
	{
		name: 'Facebook story',
		resource: 'facebook',
		params: {
			operation: 'publishStory',
			connectionId: 'facebook-1',
			mediaSource: 'dohooUrl',
			mediaUrl: imageUrl,
			storyMediaType: 'photo',
		},
		path: '/api/v1/facebook/publish/story',
		checkBody: (body) => assert.equal(body.mediaUrl, imageUrl),
	},
	{
		name: 'TikTok video',
		resource: 'tiktok',
		params: {
			operation: 'publishVideo',
			connectionId: '3892',
			mediaSource: 'dohooUrl',
			mediaUrl: videoUrl,
			additionalFields: {
				description: 'Contract test',
				visibility: 'SELF_ONLY',
				disableComment: false,
				disableDuet: false,
				disableStitch: false,
				sendToDraft: true,
			},
			publishMode: 'now',
		},
		path: '/api/social/post',
		checkBody: (body) => {
			assert.deepEqual(body.platforms, [3892]);
			assert.equal(body.fileUrl, videoUrl);
			assert.equal(body.description, 'Contract test');
			assert.equal(body.tiktokSendToDraft['3892'], true);
		},
	},
	{
		name: 'TikTok carousel',
		resource: 'tiktok',
		params: {
			operation: 'publishCarousel',
			connectionId: 'tiktok-1',
			mediaItems: { items: [{ url: imageUrl }, { url: imageUrl }] },
			description: 'Contract carousel',
			additionalFields: { visibility: 'SELF_ONLY', autoMusic: false, coverIndex: 0 },
			publishMode: 'now',
		},
		path: '/api/v2/tiktok/publish',
		checkBody: (body) => assert.equal(body.mediaUrls.length, 2),
	},
	{
		name: 'YouTube video',
		resource: 'youtube',
		params: {
			operation: 'publish',
			connectionId: 'youtube-1',
			mediaSource: 'dohooUrl',
			mediaUrl: videoUrl,
			title: 'Contract test',
			additionalFields: {
				description: 'Contract test',
				visibility: 'private',
				tags: 'n8n, dohoo',
				category: '22',
				thumbnailUrl: '',
			},
			publishMode: 'now',
		},
		path: '/api/v2/youtube/publish',
		checkBody: (body) => {
			assert.equal(body.fileUrl, videoUrl);
			assert.deepEqual(body.tags, ['n8n', 'dohoo']);
		},
	},
	{
		name: 'YouTube thumbnail',
		resource: 'youtube',
		params: {
			operation: 'setThumbnail',
			connectionId: 'youtube-1',
			videoId: 'video/with space',
			existingThumbnailUrl: imageUrl,
		},
		path: '/api/v2/youtube/thumbnail/video%2Fwith%20space',
		checkBody: (body) => assert.equal(body.thumbnailUrl, imageUrl),
	},
	{
		name: 'X text post',
		resource: 'x',
		params: {
			operation: 'publish',
			connectionId: 'twitter-1',
			mediaSource: 'none',
			text: 'Contract test',
			publishMode: 'now',
		},
		path: '/api/v2/twitter/publish',
		checkBody: (body) => assert.equal(body.text, 'Contract test'),
	},
	{
		name: 'LinkedIn text post',
		resource: 'linkedin',
		params: {
			operation: 'publish',
			connectionId: 'linkedin-1',
			mediaSource: 'none',
			text: 'Contract test',
			additionalFields: { organizationId: '' },
			publishMode: 'now',
		},
		path: '/api/v2/linkedin/publish',
		checkBody: (body) => assert.equal(body.connectionId, 'linkedin-1'),
	},
	{
		name: 'Pinterest pin',
		resource: 'pinterest',
		params: {
			operation: 'publish',
			connectionId: { mode: 'list', value: 'pinterest-1' },
			boardId: { mode: 'list', value: 'board-1' },
			mediaSource: 'dohooUrl',
			mediaUrl: imageUrl,
			additionalFields: {
				title: 'Contract test',
				description: 'Description must be preserved #n8n',
				link: 'https://dohoo.ai',
				altText: 'Contract test image',
			},
			publishMode: 'now',
		},
		path: '/api/v2/pinterest/publish',
		checkBody: (body) => {
			assert.equal(body.connectionId, 'pinterest-1');
			assert.equal(body.boardId, 'board-1');
			assert.equal(body.fileUrl, imageUrl);
			assert.equal(body.description, 'Description must be preserved #n8n');
		},
	},
	{
		name: 'Threads text post',
		resource: 'threads',
		params: {
			operation: 'publish',
			connectionId: 'threads-1',
			mediaSource: 'none',
			text: 'Contract test',
			publishMode: 'now',
		},
		path: '/api/v2/threads/publish',
		checkBody: (body) => assert.equal(body.mediaType, 'text'),
	},
	{
		name: 'Transcription',
		resource: 'transcription',
		params: {
			operation: 'transcribe',
			mediaSource: 'dohooUrl',
			mediaUrl: videoUrl,
			additionalFields: { language: 'ru' },
		},
		path: '/api/transcriptions',
		checkBody: (body) => {
			assert.equal(body.url, videoUrl);
			assert.equal(body.language, 'ru');
		},
	},
];

test('Facebook exposes only the media types supported by the DOHOO API', () => {
	const definition = new Dohoo().description;
	const resource = definition.properties.find((property) => property.name === 'resource');
	assert.ok(resource);
	const facebookOption = resource.options.find((option) => option.value === 'facebook');
	assert.ok(facebookOption);

	const mediaType = definition.properties.find(
		(property) =>
			property.name === 'mediaType' && property.displayOptions?.show?.resource?.includes('facebook'),
	);
	assert.ok(mediaType);
	assert.deepEqual(
		mediaType.options.map((option) => option.value),
		['photo', 'text', 'video'],
	);
});

test('DOHOO node exposes searchable social media metadata', () => {
	const definition = new Dohoo().description;
	const expectedAliases = [
		'Social Media',
		'Instagram',
		'TikTok',
		'Facebook',
		'YouTube',
		'X',
		'Twitter',
		'LinkedIn',
		'Pinterest',
		'Threads',
	];

	assert.ok(definition.codex);
	for (const alias of expectedAliases) {
		assert.ok(definition.codex.alias.includes(alias), `Missing search alias: ${alias}`);
	}
	assert.match(definition.description, /publish and schedule/i);
});

function makeContext(params, apiReply) {
	const apiCalls = [];
	const publicCalls = [];
	const context = {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _itemIndex, defaultValue) => {
			if (Object.hasOwn(params, name)) return params[name];
			if (name === 'output') return 'raw';
			return defaultValue;
		},
		getNode: () => ({
			name: 'DOHOO Contract Test',
			type: 'n8n-nodes-dohoo.contractTest',
			typeVersion: 1,
			position: [0, 0],
			parameters: params,
		}),
		continueOnFail: () => false,
		helpers: {
			httpRequest: async (options) => {
				publicCalls.push(options);
				return { statusCode: 200, headers: {}, body: null };
			},
			httpRequestWithAuthentication: async (_credentialType, options) => {
				apiCalls.push(options);
				if (apiReply) return await apiReply(options);
				if (options.url === '/api/social/post') {
					return {
						success: true,
						results: [{ connectionId: params.connectionId, success: true }],
					};
				}
				return { success: true };
			},
		},
	};
	return { context, apiCalls, publicCalls };
}

for (const nodeCase of nodeCases) {
	test(`${nodeCase.name} maps to the documented DOHOO request`, async () => {
		const params = { resource: nodeCase.resource, ...nodeCase.params };
		const { context, apiCalls } = makeContext(params);
		const output = await new Dohoo().execute.call(context);
		assert.equal(output[0].length, 1);
		const call = apiCalls.at(-1);
		assert.ok(call, 'Expected an authenticated DOHOO API call');
		assert.equal(call.method, 'POST');
		assert.equal(call.url, nodeCase.path);
		nodeCase.checkBody(call.body);
	});
}

test('TikTok video rejects a non-numeric connection ID before calling the publication API', async () => {
	const { context, apiCalls } = makeContext({
		resource: 'tiktok',
		operation: 'publishVideo',
		connectionId: 'not-a-number',
		mediaSource: 'dohooUrl',
		mediaUrl: videoUrl,
		additionalFields: { visibility: 'SELF_ONLY' },
		publishMode: 'now',
	});

	await assert.rejects(
		new Dohoo().execute.call(context),
		/connection ID must be a positive integer/,
	);
	assert.equal(apiCalls.length, 0);
});

test('Pinterest board operations use connection-scoped endpoints', async () => {
	const list = makeContext(
		{ resource: 'pinterest', operation: 'listBoards', connectionId: 'pin/1' },
		async () => ({
			success: true,
			boards: [{ id: 'board-1', name: 'Test' }],
		}),
	);
	const listed = await new Dohoo().execute.call(list.context);
	assert.equal(list.apiCalls[0].url, '/api/v2/pinterest/boards/pin%2F1');
	assert.equal(list.apiCalls[0].method, 'GET');
	assert.equal(listed[0][0].json.id, 'board-1');

	const create = makeContext({
		resource: 'pinterest',
		operation: 'createBoard',
		connectionId: 'pin/1',
		boardName: 'Contract board',
		additionalFields: {
			boardDescription: 'Created by an isolated contract test',
			privacy: 'SECRET',
		},
	});
	await new Dohoo().execute.call(create.context);
	assert.equal(create.apiCalls[0].url, '/api/v2/pinterest/boards/pin%2F1');
	assert.equal(create.apiCalls[0].method, 'POST');
	assert.equal(create.apiCalls[0].body.privacy, 'SECRET');
});

for (const [shape, response] of [
	['root array', [{ id: 'root-board', name: 'Root board' }]],
	['data wrapper', { data: [{ id: 'data-board', name: 'Data board' }] }],
	['nested data wrapper', { data: { boards: [{ id: 'nested-board', name: 'Nested board' }] } }],
]) {
	test(`Pinterest List Boards supports the ${shape} response`, async () => {
		const list = makeContext(
			{ resource: 'pinterest', operation: 'listBoards', connectionId: 'pin-1' },
			async () => response,
		);
		const output = await new Dohoo().execute.call(list.context);
		assert.equal(output[0].length, 1);
		assert.ok(output[0][0].json.id);
	});
}

test('Media read operations normalize live response shapes', async () => {
	const latest = makeContext({ resource: 'media', operation: 'getLatest' }, async () => ({
		success: true,
		file: { id: 42, status: 'completed', url: imageUrl },
	}));
	const latestOutput = await new Dohoo().execute.call(latest.context);
	assert.equal(latest.apiCalls[0].url, '/api/upload/latest');
	assert.equal(latestOutput[0][0].json.fileUrl, imageUrl);

	const list = makeContext(
		{
			resource: 'media',
			operation: 'list',
			additionalFields: {
				page: 2,
				pageSize: 10,
				search: 'test',
				mimeType: 'image/',
				status: 'completed',
			},
		},
		async () => ({ files: [{ id: 43, status: 'completed', url: imageUrl }] }),
	);
	const listOutput = await new Dohoo().execute.call(list.context);
	assert.equal(list.apiCalls[0].url, '/api/upload/files/search');
	assert.deepEqual(list.apiCalls[0].qs, {
		page: 2,
		pageSize: 10,
		search: 'test',
		mimeType: 'image/',
		status: 'completed',
	});
	assert.equal(listOutput[0][0].json.fileUrl, imageUrl);

	const nestedList = makeContext(
		{
			resource: 'media',
			operation: 'list',
			page: 1,
			pageSize: 10,
			search: '',
			mimeType: '',
			status: '',
		},
		async () => ({ data: { files: [{ id: 46, status: 'completed', url: imageUrl }] } }),
	);
	const nestedListOutput = await new Dohoo().execute.call(nestedList.context);
	assert.equal(nestedListOutput[0][0].json.fileUrl, imageUrl);

	const status = makeContext(
		{ resource: 'media', operation: 'getStatus', targetFileId: 44 },
		async () => ({
		success: true,
		status: 'completed',
		file: { id: 44, url: imageUrl },
		}),
	);
	const statusOutput = await new Dohoo().execute.call(status.context);
	assert.equal(status.apiCalls[0].url, '/api/upload/status/44');
	assert.equal(statusOutput[0][0].json.file.fileUrl, imageUrl);
});

test('Media URL and existing-media upload operations return canonical URLs', async () => {
	const getUrl = makeContext({ resource: 'media', operation: 'getUrl', targetFileId: 45 }, async (options) => {
		if (options.url === '/api/upload/status/45') {
			return { success: true, status: 'completed', file: { id: 45, url: imageUrl } };
		}
		return { success: true, file: { id: 45, url: imageUrl } };
	});
	const getUrlOutput = await new Dohoo().execute.call(getUrl.context);
	assert.equal(getUrlOutput[0][0].json.fileUrl, imageUrl);

	const upload = makeContext({
		resource: 'media',
		operation: 'upload',
		mediaSource: 'dohooUrl',
		mediaUrl: imageUrl,
	});
	const uploadOutput = await new Dohoo().execute.call(upload.context);
	assert.equal(upload.apiCalls.length, 0);
	assert.equal(uploadOutput[0][0].json.fileUrl, imageUrl);
	assert.equal(uploadOutput[0][0].json.readyForPublish, true);
});

test('Scheduled Posts sends filters as query parameters', async () => {
	const { context, apiCalls } = makeContext(
		{
			resource: 'scheduledPosts',
			operation: 'list',
			period: 'custom',
			from: '2026-08-01T00:00:00.000Z',
			to: '2026-08-31T23:59:59.000Z',
			additionalFields: {
				status: 'all',
				platform: 'instagram',
				limit: 25,
				offset: 5,
			},
		},
		async () => ({ success: true, posts: [] }),
	);
	await new Dohoo().execute.call(context);
	assert.equal(apiCalls[0].url, '/api/scheduled-posts');
	assert.deepEqual(apiCalls[0].qs, {
		period: 'custom',
		status: 'all',
		limit: 25,
		offset: 5,
		platform: 'instagram',
		from: '2026-08-01',
		to: '2026-08-31',
	});
});

test('Scheduled Posts supports a data-wrapped response', async () => {
	const { context } = makeContext(
		{
			resource: 'scheduledPosts',
			operation: 'list',
			period: 'week',
			status: 'pending',
			platform: '',
			limit: 10,
			offset: 0,
		},
		async () => ({ data: { posts: [{ id: 'scheduled-1', status: 'pending' }] } }),
	);
	const output = await new Dohoo().execute.call(context);
	assert.equal(output[0][0].json.id, 'scheduled-1');
});

test('Output modes simplify or select fields without losing an available ID', async () => {
	const rawReply = {
		success: true,
		message: 'Created',
		result: {
			id: 'post-1',
			status: 'published',
			url: 'https://example.com/post-1',
			extraOne: 1,
			extraTwo: 2,
			extraThree: 3,
			extraFour: 4,
			extraFive: 5,
			extraSix: 6,
			extraSeven: 7,
			extraEight: 8,
		},
	};
	const simplified = makeContext(
		{
			resource: 'facebook',
			operation: 'publish',
			connectionId: 'facebook-1',
			mediaSource: 'none',
			caption: 'Test',
			publishMode: 'now',
			output: 'simplified',
		},
		async () => rawReply,
	);
	const simplifiedOutput = await new Dohoo().execute.call(simplified.context);
	assert.ok(Object.keys(simplifiedOutput[0][0].json).length <= 10);
	assert.equal(simplifiedOutput[0][0].json.id, 'post-1');

	const selected = makeContext(
		{
			resource: 'facebook',
			operation: 'publish',
			connectionId: 'facebook-1',
			mediaSource: 'none',
			caption: 'Test',
			publishMode: 'now',
			output: 'selected',
			selectedFields: ['status'],
		},
		async () => rawReply,
	);
	const selectedOutput = await new Dohoo().execute.call(selected.context);
	assert.deepEqual(selectedOutput[0][0].json, { id: 'post-1', status: 'published' });
});

test('all 21 visible operations are covered by the package descriptors', () => {
	const expected = new Map([
		['instagram', ['publish', 'publishCarousel']],
		['facebook', ['publish', 'publishStory']],
		['tiktok', ['publishVideo', 'publishCarousel']],
		['youtube', ['publish', 'setThumbnail']],
		['x', ['publish']],
		['linkedin', ['publish']],
		['pinterest', ['publish', 'listBoards', 'createBoard']],
		['threads', ['publish']],
		['media', ['getUrl', 'getLatest', 'getStatus', 'list', 'upload']],
		['scheduledPosts', ['list']],
		['transcription', ['transcribe']],
	]);
	const description = new Dohoo().description;
	let count = 0;
	for (const [resource, operations] of expected) {
		const property = description.properties.find(
			(candidate) =>
				candidate.name === 'operation' &&
				candidate.displayOptions?.show?.resource?.includes(resource),
		);
		assert.ok(property, `Missing operation selector for ${resource}`);
		const actual = property.options.map((option) => option.value);
		assert.deepEqual(actual, operations);
		count += actual.length;
	}
	assert.equal(count, 21);
	const resource = description.properties.find((candidate) => candidate.name === 'resource');
	assert.equal(resource.options.length, 11);
});

test('the unified node scopes every operation field to exactly one resource', () => {
	const properties = new Dohoo().description.properties;
	for (const property of properties.filter(
		(candidate) => !['resource', 'output', 'selectedFields'].includes(candidate.name),
	)) {
		const resources = property.displayOptions?.show?.resource;
		assert.ok(resources, `${property.displayName} is missing a resource visibility condition`);
		assert.equal(resources.length, 1);
	}
});

test('optional operation fields are grouped in alphabetized Additional Fields collections', () => {
	const properties = new Dohoo().description.properties;
	const expected = [
		['facebook', 'publish', 'caption'],
		['instagram', 'publish', 'caption'],
		['instagram', 'publishCarousel', 'caption'],
		['linkedin', 'publish', 'organizationId'],
		['media', 'list', 'pageSize'],
		['pinterest', 'publish', 'description'],
		['pinterest', 'createBoard', 'privacy'],
		['scheduledPosts', 'list', 'platform'],
		['tiktok', 'publishVideo', 'disableComment'],
		['tiktok', 'publishCarousel', 'autoMusic'],
		['transcription', 'transcribe', 'language'],
		['youtube', 'publish', 'visibility'],
	];

	for (const [resource, operation, field] of expected) {
		const collection = properties.find(
			(property) =>
				property.name === 'additionalFields' &&
				property.displayOptions?.show?.resource?.includes(resource) &&
				property.displayOptions?.show?.operation?.includes(operation) &&
				property.options?.some((option) => option.name === field),
		);
		assert.ok(collection, `${resource}.${operation}.${field} is not in Additional Fields`);
	}

	for (const collection of properties.filter((property) => property.name === 'additionalFields')) {
		const names = collection.options.map((option) => option.displayName);
		assert.deepEqual(names, [...names].sort((left, right) => left.localeCompare(right)));
	}
});

test('all operations include action and description metadata', () => {
	const operationProperties = new Dohoo().description.properties.filter(
		(property) => property.name === 'operation',
	);
	const resourceTerms = {
		facebook: 'facebook',
		instagram: 'instagram',
		linkedin: 'linkedin',
		media: 'dohoo',
		pinterest: 'pinterest',
		scheduledPosts: 'dohoo',
		threads: 'threads',
		tiktok: 'tiktok',
		transcription: 'dohoo',
		x: 'x',
		youtube: 'youtube',
	};
	for (const property of operationProperties) {
		const resource = property.displayOptions.show.resource[0];
		for (const option of property.options) {
			assert.ok(option.action, `${option.name} is missing action metadata`);
			assert.ok(option.description, `${option.name} is missing description metadata`);
			assert.ok(
				option.action.toLowerCase().includes(resourceTerms[resource]),
				`${option.name} action does not identify its resource`,
			);
		}
	}
});

test('boolean parameters explain their behavior with Whether descriptions', () => {
	const booleanProperties = new Dohoo().description.properties.flatMap((property) => [
		...(property.type === 'boolean' ? [property] : []),
		...(property.type === 'collection'
			? property.options.filter((option) => option.type === 'boolean')
			: []),
	]);
	assert.ok(booleanProperties.length > 0);
	for (const property of booleanProperties) {
		assert.match(property.description ?? '', /^Whether\b/);
	}
});

test('the unified connection loader filters accounts for the selected resource', async () => {
	const context = {
		getNodeParameter: (name, defaultValue) =>
			name === 'resource' ? 'instagram' : defaultValue,
		helpers: {
			httpRequestWithAuthentication: async (_credentialType, options) => {
				assert.equal(options.url, '/api/connections/unified');
				return {
					connections: [
						{ id: 1, platform: 'instagram_business', username: 'instagram-test' },
						{ id: 2, platform: 'facebook_page', username: 'facebook-test' },
						{ id: 3, platform: 'instagram', username: 'disabled', active: false },
					],
				};
			},
		},
	};
	const options = await new Dohoo().methods.loadOptions.getConnections.call(context);
	assert.deepEqual(options, [{ name: 'instagram-test', value: '1' }]);
	const search = await new Dohoo().methods.listSearch.searchConnections.call(context, 'gram');
	assert.deepEqual(search, { results: [{ name: 'instagram-test', value: '1' }] });
});
