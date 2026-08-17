const assert = require('node:assert/strict');
const test = require('node:test');

const { Dohoo } = require('../dist/nodes/Dohoo/Dohoo.node.js');
const {
	createConnectionLoader,
	getPinterestBoards,
} = require('../dist/nodes/shared/loadOptions.js');

function makeLoadOptionsContext(connectionId, response) {
	const calls = [];
	return {
		calls,
		context: {
			getNodeParameter: (name, defaultValue) =>
				name === 'connectionId' ? connectionId : defaultValue,
			helpers: {
				httpRequestWithAuthentication: async (_credentialType, options) => {
					calls.push(options);
					return response;
				},
			},
		},
	};
}

test('Pinterest board dropdown reloads when the connection changes', () => {
	const boardProperty = new Dohoo().description.properties.find(
		(property) =>
			property.name === 'boardId' && property.displayOptions?.show?.resource?.includes('pinterest'),
	);

	assert.ok(boardProperty);
	assert.equal(boardProperty.type, 'resourceLocator');
	assert.deepEqual(boardProperty.typeOptions.loadOptionsDependsOn, ['connectionId.value']);
	assert.deepEqual(
		boardProperty.modes.map((mode) => mode.name),
		['list', 'id'],
	);
});

for (const [shape, response] of [
	['root array', [{ id: 'root-1', name: 'Root board' }]],
	['boards wrapper', { boards: [{ id: 'boards-1', name: 'Boards wrapper' }] }],
	['data wrapper', { data: [{ id: 'data-1', name: 'Data wrapper' }] }],
	['nested data wrapper', { data: { boards: [{ id: 'nested-1', name: 'Nested board' }] } }],
]) {
	test(`Pinterest board dropdown supports the ${shape} response`, async () => {
		const { context, calls } = makeLoadOptionsContext(
			{ mode: 'list', value: 'pin/1' },
			response,
		);
		const options = await getPinterestBoards.call(context);

		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, '/api/v2/pinterest/boards/pin%2F1');
		assert.equal(options.length, 1);
		assert.ok(options[0].name);
		assert.ok(options[0].value);
	});
}

test('Pinterest board dropdown does not call the API without a connection', async () => {
	const { context, calls } = makeLoadOptionsContext('', { boards: [] });
	const options = await getPinterestBoards.call(context);

	assert.deepEqual(options, []);
	assert.equal(calls.length, 0);
});

test('social connections use a list-first resource locator with manual ID fallback', () => {
	const connectionProperty = new Dohoo().description.properties.find(
		(property) =>
			property.name === 'connectionId' &&
			property.displayOptions?.show?.resource?.includes('instagram'),
	);

	assert.ok(connectionProperty);
	assert.equal(connectionProperty.type, 'resourceLocator');
	assert.deepEqual(connectionProperty.default, { mode: 'list', value: '' });
	assert.deepEqual(
		connectionProperty.modes.map((mode) => mode.name),
		['list', 'id'],
	);
});

for (const [shape, response] of [
	['root array', [{ id: 'root-connection', platform: 'instagram', name: 'Root account' }]],
	[
		'connections wrapper',
		{ connections: [{ id: 'wrapped-connection', platform: 'instagram', name: 'Wrapped account' }] },
	],
	[
		'data wrapper',
		{ data: [{ id: 'data-connection', platform: 'instagram', name: 'Data account' }] },
	],
	[
		'nested data wrapper',
		{
			data: {
				connections: [
					{ id: 'nested-connection', platform: 'instagram', name: 'Nested account' },
				],
			},
		},
	],
]) {
	test(`social connection loader supports the ${shape} response`, async () => {
		const calls = [];
		const context = {
			helpers: {
				httpRequestWithAuthentication: async (_credentialType, options) => {
					calls.push(options);
					return response;
				},
			},
		};
		const options = await createConnectionLoader(['instagram']).call(context);

		assert.equal(calls.length, 1);
		assert.equal(calls[0].url, '/api/connections/unified');
		assert.equal(options.length, 1);
		assert.ok(options[0].name);
		assert.ok(options[0].value);
	});
}
