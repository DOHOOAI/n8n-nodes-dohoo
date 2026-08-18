const assert = require('node:assert/strict');
const test = require('node:test');

const { messageFromError, toNodeError } = require('../dist/nodes/shared/errors.js');

function errorContext() {
	return {
		getNode: () => ({
			name: 'DOHOO Error Test',
			type: 'n8n-nodes-dohoo.errorTest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	};
}

test('prefers the DOHOO response body over a generic transport error', () => {
	const error = {
		message: 'Request failed with status code 400',
		response: {
			status: 400,
			data: { error: 'platforms[0] must be a number' },
		},
	};

	assert.equal(messageFromError(error), 'platforms[0] must be a number');
	const nodeError = toNodeError(errorContext(), error, 0);
	assert.equal(nodeError.message, 'platforms[0] must be a number');
	assert.equal(nodeError.httpCode, '400');
	assert.match(nodeError.description, /DOHOO API returned HTTP 400/);
});

test('extracts validation messages from a JSON response string', () => {
	const error = {
		message: 'Request failed with status code 400',
		response: {
			statusCode: 400,
			body: JSON.stringify({ errors: [{ message: 'Visibility is not available' }] }),
		},
	};

	assert.equal(messageFromError(error), 'Visibility is not available');
});
