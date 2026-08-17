const assert = require('node:assert/strict');
const test = require('node:test');

const { Dohoo } = require('../dist/nodes/Dohoo/Dohoo.node.js');
const { getPinterestBoards } = require('../dist/nodes/shared/loadOptions.js');

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
	assert.deepEqual(boardProperty.typeOptions.loadOptionsDependsOn, ['connectionId']);
});

for (const [shape, response] of [
	['root array', [{ id: 'root-1', name: 'Root board' }]],
	['boards wrapper', { boards: [{ id: 'boards-1', name: 'Boards wrapper' }] }],
	['data wrapper', { data: [{ id: 'data-1', name: 'Data wrapper' }] }],
	['nested data wrapper', { data: { boards: [{ id: 'nested-1', name: 'Nested board' }] } }],
]) {
	test(`Pinterest board dropdown supports the ${shape} response`, async () => {
		const { context, calls } = makeLoadOptionsContext('pin/1', response);
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
