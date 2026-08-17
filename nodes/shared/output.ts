import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

const outputFieldOptions = [
	{ name: 'Connection ID', value: 'connectionId' },
	{ name: 'Created At', value: 'createdAt' },
	{ name: 'Error', value: 'error' },
	{ name: 'File ID', value: 'fileId' },
	{ name: 'File URL', value: 'fileUrl' },
	{ name: 'ID', value: 'id' },
	{ name: 'Message', value: 'message' },
	{ name: 'Platform', value: 'platform' },
	{ name: 'Post ID', value: 'postId' },
	{ name: 'Scheduled At', value: 'scheduledAt' },
	{ name: 'Status', value: 'status' },
	{ name: 'Success', value: 'success' },
	{ name: 'Text', value: 'text' },
	{ name: 'Title', value: 'title' },
	{ name: 'Transcript', value: 'transcript' },
	{ name: 'URL', value: 'url' },
	{ name: 'Video ID', value: 'videoId' },
];

export const outputProperties: INodeProperties[] = [
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Simplified',
				value: 'simplified',
				description: 'Return up to ten of the most useful fields',
			},
			{
				name: 'Raw',
				value: 'raw',
				description: 'Return every field provided by DOHOO',
			},
			{
				name: 'Selected Fields',
				value: 'selected',
				description: 'Return only the selected fields when they are available',
			},
		],
		default: 'simplified',
		description: 'How much data to return from DOHOO',
	},
	{
		displayName: 'Fields to Include',
		name: 'selectedFields',
		type: 'multiOptions',
		options: outputFieldOptions,
		default: ['id', 'status', 'url'],
		displayOptions: { show: { output: ['selected'] } },
		description: 'Fields to include in the output; an available ID field is always retained',
	},
];

function asObject(value: unknown): IDataObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as IDataObject)
		: {};
}

function flattenKnownContainers(input: IDataObject): IDataObject {
	const flattened: IDataObject = { ...input };
	for (const containerName of ['result', 'file', 'data']) {
		const container = asObject(input[containerName]);
		for (const [key, value] of Object.entries(container)) {
			if (flattened[key] === undefined) flattened[key] = value;
		}
	}
	return flattened;
}

function firstAvailableId(input: IDataObject): [string, IDataObject[string]] | undefined {
	for (const field of ['id', 'fileId', 'postId', 'videoId', 'connectionId']) {
		if (input[field] !== undefined) return [field, input[field]];
	}
	return undefined;
}

export function simplifyOutput(input: IDataObject): IDataObject {
	const flattened = flattenKnownContainers(input);
	const priority = [
		'success',
		'id',
		'fileId',
		'postId',
		'videoId',
		'status',
		'fileUrl',
		'url',
		'transcript',
		'text',
		'message',
		'error',
	];
	const output: IDataObject = {};
	for (const field of priority) {
		if (flattened[field] !== undefined) output[field] = flattened[field];
		if (Object.keys(output).length === 10) return output;
	}
	for (const [field, value] of Object.entries(flattened)) {
		if (output[field] !== undefined || (value !== null && typeof value === 'object')) continue;
		output[field] = value;
		if (Object.keys(output).length === 10) break;
	}
	return output;
}

export function selectOutput(input: IDataObject, fields: string[]): IDataObject {
	const flattened = flattenKnownContainers(input);
	const output: IDataObject = {};
	const id = firstAvailableId(flattened);
	if (id) output[id[0]] = id[1];
	for (const field of fields) {
		if (flattened[field] !== undefined) output[field] = flattened[field];
	}
	return output;
}

export function applyOutputMode(
	context: IExecuteFunctions,
	data: INodeExecutionData[][],
): INodeExecutionData[][] {
	const mode = String(context.getNodeParameter('output', 0, 'simplified'));
	if (mode === 'raw') return data;
	const fields = context.getNodeParameter('selectedFields', 0, []) as string[];
	return data.map((items) =>
		items.map((item) => ({
			...item,
			json: mode === 'selected' ? selectOutput(item.json, fields) : simplifyOutput(item.json),
		})),
	);
}
