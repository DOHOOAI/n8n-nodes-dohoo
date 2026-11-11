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
import { locatorValue } from '../locators';
import { createConnectionLoader } from '../loadOptions';
import { resolveMediaUrl } from '../media';
import {
	connectionProperty,
	mediaSourceProperties,
	schedulingProperties,
} from '../properties';
import { addSchedule, publish } from '../publication';

const MULTIPOST_REPLY_FIELDS = new Set([
	'text_attachment',
	'poll_attachment',
	'text_entities',
	'topic_tag',
]);

function readMultipostReplies(context: IExecuteFunctions, itemIndex: number): Array<string | IDataObject> {
	const collection = context.getNodeParameter('replies', itemIndex, {}) as IDataObject;
	const entries = Array.isArray(collection.items) ? collection.items : [];
	if (entries.length < 1 || entries.length > 4) {
		throw new NodeOperationError(context.getNode(), 'Provide between 1 and 4 Threads replies', {
			itemIndex,
		});
	}

	return entries.map((entry, index) => {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			throw new NodeOperationError(context.getNode(), `Threads reply ${index + 1} must be an object`, {
				itemIndex,
			});
		}
		const reply = entry as IDataObject;
		const text = String(reply.text ?? '');
		if (!text.trim() || [...text].length > TEXT_LIMITS.threadsText) {
			throw new NodeOperationError(
				context.getNode(),
				`Threads reply ${index + 1} must contain 1–${TEXT_LIMITS.threadsText} characters`,
				{ itemIndex },
			);
		}

		const rawOptions = reply.advancedFields;
		if (rawOptions === undefined || rawOptions === null || rawOptions === '') return text;
		let options: unknown = rawOptions;
		if (typeof rawOptions === 'string') {
			try {
				options = JSON.parse(rawOptions) as unknown;
			} catch {
				throw new NodeOperationError(context.getNode(), `Threads reply ${index + 1} has invalid JSON`, {
					itemIndex,
				});
			}
		}
		if (!options || typeof options !== 'object' || Array.isArray(options)) {
			throw new NodeOperationError(context.getNode(), `Threads reply ${index + 1} options must be a JSON object`, {
				itemIndex,
			});
		}
		const fields = options as IDataObject;
		const invalidField = Object.keys(fields).find((field) => !MULTIPOST_REPLY_FIELDS.has(field));
		if (invalidField) {
			throw new NodeOperationError(
				context.getNode(),
				`Threads reply ${index + 1} does not support ${invalidField}`,
				{ itemIndex },
			);
		}
		if (fields.text_attachment !== undefined && fields.poll_attachment !== undefined) {
			throw new NodeOperationError(
				context.getNode(),
				`Threads reply ${index + 1} cannot combine text_attachment and poll_attachment`,
				{ itemIndex },
			);
		}
		return Object.keys(fields).length ? { text, ...fields } : text;
	});
}

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
				options: [
					{
						name: 'Publish Post',
						value: 'publish',
						action: 'Publish threads post',
						description: 'Publish text with optional image or video media to Threads',
					},
					{
						name: 'Publish Multipost',
						value: 'publishMultipost',
						action: 'Publish threads multipost',
						description: 'Publish a root post followed by 1–4 text replies in order',
					},
				],
				default: 'publish',
			},
			connectionProperty('Threads'),
			...mediaSourceProperties({ operations: ['publish', 'publishMultipost'], required: false }),
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.threadsText },
				default: '',
				description: 'Root post text. Optional when a photo or video is provided.',
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
			{
				displayName: 'Replies',
				name: 'replies',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, minRequiredFields: 1 },
				default: {},
				required: true,
				placeholder: 'Add Reply',
				displayOptions: { show: { operation: ['publishMultipost'] } },
				description: 'One to four text replies published in the order shown. The Threads account must allow managing replies.',
				options: [
					{
						displayName: 'Reply',
						name: 'items',
						values: [
							{
								displayName: 'Text',
								name: 'text',
								type: 'string',
								typeOptions: { rows: 3, maxValue: TEXT_LIMITS.threadsText },
								default: '',
								required: true,
								description: 'Text of this reply (maximum 500 Unicode characters)',
							},
							{
								displayName: 'Advanced Reply Fields (JSON)',
								name: 'advancedFields',
								type: 'json',
								default: '',
								description: 'Optional JSON object with text_attachment, poll_attachment, text_entities, or topic_tag. Replies cannot contain media.',
							},
						],
					},
				],
			},
			...schedulingProperties(['publish', 'publishMultipost']),
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
			const operation = String(this.getNodeParameter('operation', itemIndex));
			const replies = operation === 'publishMultipost' ? readMultipostReplies(this, itemIndex) : undefined;
			const mediaUrl = await resolveMediaUrl(this, itemIndex);
			const text = String(this.getNodeParameter('text', itemIndex, ''));
			if (!text.trim() && !mediaUrl) {
				throw new NodeOperationError(this.getNode(), 'Threads post needs text or media', { itemIndex });
			}
			const body: IDataObject = {
				connectionId: locatorValue(this.getNodeParameter('connectionId', itemIndex)),
				text,
				mediaType: mediaUrl ? String(this.getNodeParameter('mediaType', itemIndex)) : 'text',
			};
			if (mediaUrl) body.mediaUrl = mediaUrl;
			if (replies) body.replies = replies;
			addSchedule(this, itemIndex, body);
			if (operation !== 'publishMultipost') {
				return await publish(this, '/api/v2/threads/publish', body);
			}
			try {
				return await publish(this, '/api/v2/threads/multipost', body);
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`${error instanceof Error ? error.message : String(error)}. Some replies may already be published; check Threads before retrying.`,
					{ itemIndex },
				);
			}
		});
	}
}
