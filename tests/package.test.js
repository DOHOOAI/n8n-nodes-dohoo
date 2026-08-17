const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const packageJson = require('../package.json');

test('registers one unified DOHOO node', () => {
	assert.deepEqual(packageJson.n8n.nodes, ['dist/nodes/Dohoo/Dohoo.node.js']);
	const modulePath = path.resolve(__dirname, '..', packageJson.n8n.nodes[0]);
	const { Dohoo } = require(modulePath);
	const instance = new Dohoo();
	assert.equal(instance.description.displayName, 'DOHOO');
	assert.equal(instance.description.name, 'dohoo');
	assert.equal(instance.description.version, 1);
	const resource = instance.description.properties.find((property) => property.name === 'resource');
	assert.ok(resource);
	assert.equal(resource.options.length, 11);
});

test('does not declare runtime dependencies', () => {
	assert.deepEqual(packageJson.dependencies, undefined);
});

test('registers the DOHOO API credential', () => {
	assert.deepEqual(packageJson.n8n.credentials, ['dist/credentials/DohooApi.credentials.js']);
	const { DohooApi } = require('../dist/credentials/DohooApi.credentials.js');
	const credential = new DohooApi();
	assert.equal(credential.name, 'dohooApi');
	assert.equal(credential.properties[0].typeOptions.password, true);
	assert.equal(credential.authenticate.properties.headers['X-API-Key'], '={{$credentials.apiKey}}');
	assert.deepEqual(credential.test.request, {
		baseURL: 'https://dohoo.ai',
		url: '/api/auth/me',
		method: 'GET',
	});
});
