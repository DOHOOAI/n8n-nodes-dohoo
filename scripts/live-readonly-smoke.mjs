const apiKey = process.env.DOHOO_API_KEY;

if (!apiKey) {
	throw new Error('DOHOO_API_KEY is required');
}

const checks = [
	{ name: 'auth', path: '/api/auth/me' },
	{ name: 'connections', path: '/api/connections/unified' },
	{ name: 'files', path: '/api/upload/files/search?page=1&pageSize=2' },
	{
		name: 'scheduledPosts',
		path: '/api/scheduled-posts?period=week&status=pending&limit=2&offset=0',
	},
];

let connectionsForFollowUp = [];
let fileIdForFollowUp;

function objectArray(value) {
	return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function countBy(items, field) {
	return Object.fromEntries(
		Object.entries(
			items.reduce((counts, item) => {
				const key = String(item[field] ?? 'unknown');
				counts[key] = (counts[key] ?? 0) + 1;
				return counts;
			}, {}),
		).sort(([left], [right]) => left.localeCompare(right)),
	);
}

function urlKind(value) {
	if (typeof value !== 'string' || !value) return 'missing';
	if (value.startsWith('https://mediastorage.dohoo.ai/file/dohoo-video-storage/')) {
		return 'canonical-media-storage';
	}
	if (value.startsWith('https://dohoo.ai/api/upload/file/')) return 'upload-redirect';
	if (value.startsWith('https://dohoo.ai/api/upload/direct/')) return 'api-json-endpoint';
	return 'other';
}

function urlFieldKinds(value) {
	if (!value || typeof value !== 'object') return {};
	return Object.fromEntries(
		['url', 'fileUrl', 'directFileUrl', 'directHttpsUrl', 'mediaUrl']
			.filter((field) => field in value)
			.map((field) => [field, urlKind(value[field])]),
	);
}

async function readJson(path) {
	const startedAt = Date.now();
	const response = await fetch(`https://dohoo.ai${path}`, {
		headers: {
			Accept: 'application/json',
			'X-API-Key': apiKey,
		},
		signal: AbortSignal.timeout(30_000),
	});
	const text = await response.text();
	let data = {};
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		data = {};
	}
	return { response, data, elapsedMs: Date.now() - startedAt };
}

for (const check of checks) {
	const { response, data, elapsedMs } = await readJson(check.path);

	const summary = {
		check: check.name,
		status: response.status,
		ok: response.ok,
		elapsedMs,
	};
	if (check.name === 'auth') {
		summary.authenticated = data.authenticated === true;
		summary.success = data.success === true;
	} else if (check.name === 'connections') {
		const connections = objectArray(data.connections ?? data.data ?? data);
		connectionsForFollowUp = connections;
		summary.count = connections.length;
		summary.platforms = countBy(connections, 'platform');
		summary.fields = connections[0] ? Object.keys(connections[0]).sort() : [];
	} else if (check.name === 'files') {
		const files = objectArray(data.files ?? data.data ?? data);
		fileIdForFollowUp = files[0]?.fileId ?? files[0]?.id;
		summary.returned = files.length;
		summary.statuses = countBy(files, 'status');
		summary.hasPagination = Boolean(data.pagination);
		summary.fields = files[0] ? Object.keys(files[0]).sort() : [];
		summary.urlFields = files[0] ? urlFieldKinds(files[0]) : {};
	} else if (check.name === 'scheduledPosts') {
		const posts = objectArray(data.posts ?? data.data ?? data);
		summary.returned = posts.length;
		summary.statuses = countBy(posts, 'status');
	}
	if (!response.ok) {
		summary.error = String(data.error ?? data.message ?? `HTTP ${response.status}`).slice(0, 300);
	}
	console.log(JSON.stringify(summary));
}

const pinterestConnection = connectionsForFollowUp.find(
	(connection) => connection.platform === 'pinterest',
);
const pinterestConnectionId = pinterestConnection?.connectionId ?? pinterestConnection?.id;
if (pinterestConnectionId !== undefined) {
	const { response, data, elapsedMs } = await readJson(
		`/api/v2/pinterest/boards/${encodeURIComponent(String(pinterestConnectionId))}`,
	);
	const boards = objectArray(data.boards ?? data.data ?? data);
	console.log(
		JSON.stringify({
			check: 'pinterestBoards',
			status: response.status,
			ok: response.ok,
			elapsedMs,
			count: boards.length,
			fields: boards[0] ? Object.keys(boards[0]).sort() : [],
		}),
	);
}

const latest = await readJson('/api/upload/latest');
const latestObject =
	latest.data?.file && typeof latest.data.file === 'object' ? latest.data.file : latest.data;
fileIdForFollowUp ??= latestObject?.fileId ?? latestObject?.id;
console.log(
	JSON.stringify({
		check: 'latestFileContract',
		status: latest.response.status,
		ok: latest.response.ok,
		elapsedMs: latest.elapsedMs,
		topLevelFields: Object.keys(latest.data ?? {}).sort(),
		fileFields: Object.keys(latestObject ?? {}).sort(),
		urlFields: urlFieldKinds(latestObject),
	}),
);

if (fileIdForFollowUp !== undefined) {
	for (const [name, path] of [
		['uploadStatusContract', `/api/upload/status/${encodeURIComponent(String(fileIdForFollowUp))}`],
		['directFileContract', `/api/upload/direct/${encodeURIComponent(String(fileIdForFollowUp))}`],
	]) {
		const { response, data, elapsedMs } = await readJson(path);
		const file = data?.file && typeof data.file === 'object' ? data.file : data;
		console.log(
			JSON.stringify({
				check: name,
				status: response.status,
				ok: response.ok,
				elapsedMs,
				topLevelFields: Object.keys(data ?? {}).sort(),
				fileFields: Object.keys(file ?? {}).sort(),
				urlFields: urlFieldKinds(file),
			}),
		);
	}
}
