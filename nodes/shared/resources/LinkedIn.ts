import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

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

export class LinkedInResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO LinkedIn',
		name: 'dohooLinkedIn',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Publish or schedule LinkedIn content through DOHOO',
		defaults: { name: 'DOHOO LinkedIn' },
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
			connectionProperty('LinkedIn'),
			...mediaSourceProperties({ operations: ['publish'], required: false }),
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.linkedinText },
				default: '',
				description: 'Required when no media file is provided',
			},
			{
				displayName: 'Media Type',
				name: 'mediaType',
				type: 'options',
				options: [
					{ name: 'Image', value: 'image' },
					{ name: 'Video', value: 'video' },
				],
				default: 'image',
				displayOptions: { hide: { mediaSource: ['none'] } },
			},
			{
				displayName: 'Organization ID',
				name: 'organizationId',
				type: 'string',
				default: '',
				description:
					'Organization ID without the urn:li:organization: prefix; leave empty for a profile post',
			},
			...schedulingProperties(['publish']),
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await createConnectionLoader(PLATFORM_CODES.linkedin).call(this);
			},
		},
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const text = String(this.getNodeParameter('text', itemIndex, ''));
			const mediaUrl = await resolveMediaUrl(this, itemIndex);
			if (!text && !mediaUrl) {
				throw new NodeOperationError(this.getNode(), 'Provide text, media, or both', { itemIndex });
			}
			const body: IDataObject = {
				connectionId: String(this.getNodeParameter('connectionId', itemIndex)),
			};
			if (text) body.text = text;
			if (mediaUrl) {
				body.mediaUrl = mediaUrl;
				body.mediaType = String(this.getNodeParameter('mediaType', itemIndex));
			}
			const organizationId = String(this.getNodeParameter('organizationId', itemIndex, ''));
			if (organizationId) body.organizationId = organizationId;
			addSchedule(this, itemIndex, body);
			return await publish(this, '/api/v2/linkedin/publish', body);
		});
	}
}
