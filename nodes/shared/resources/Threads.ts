import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { PLATFORM_CODES, TEXT_LIMITS } from '../constants';
import { executeForEachItem } from '../execution';
import { createConnectionLoader } from '../loadOptions';
import { resolveMediaUrl } from '../media';
import {
	connectionProperty,
	mediaSourceProperties,
	schedulingProperties,
} from '../properties';
import { addSchedule, publish } from '../publication';

export class ThreadsResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Threads',
		name: 'dohooThreads',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Publish or schedule Threads posts through DOHOO',
		defaults: { name: 'DOHOO Threads' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'dohooApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Publish Post', value: 'publish', action: 'Publish a post' }],
				default: 'publish',
			},
			connectionProperty('Threads'),
			...mediaSourceProperties({ operations: ['publish'], required: false }),
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.threadsText },
				default: '',
				required: true,
			},
			{
				displayName: 'Media Type',
				name: 'mediaType',
				type: 'options',
				options: [
					{ name: 'Photo', value: 'photo' },
					{ name: 'Video', value: 'video' },
				],
				default: 'photo',
				displayOptions: { hide: { mediaSource: ['none'] } },
			},
			...schedulingProperties(['publish']),
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await createConnectionLoader(PLATFORM_CODES.threads).call(this);
			},
		},
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const mediaUrl = await resolveMediaUrl(this, itemIndex);
			const body: IDataObject = {
				connectionId: String(this.getNodeParameter('connectionId', itemIndex)),
				text: String(this.getNodeParameter('text', itemIndex)),
				mediaType: mediaUrl ? String(this.getNodeParameter('mediaType', itemIndex)) : 'text',
			};
			if (mediaUrl) body.mediaUrl = mediaUrl;
			addSchedule(this, itemIndex, body);
			return await publish(this, '/api/v2/threads/publish', body);
		});
	}
}
