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
import { resolveDohooMediaUrl, resolveMediaUrl } from '../media';
import {
	additionalFieldsProperty,
	connectionProperty,
	mediaSourceProperties,
	readAdditionalField,
} from '../properties';
import { normalizeScheduledAt, publish } from '../publication';

export class YouTubeResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO YouTube',
		name: 'dohooYouTube',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Publish YouTube videos and set thumbnails through DOHOO',
		defaults: { name: 'DOHOO YouTube' },
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
						name: 'Publish Video',
						value: 'publish',
						action: 'Publish youtube video',
						description: 'Upload and optionally schedule a video for a YouTube channel',
					},
					{
						name: 'Set Thumbnail',
						value: 'setThumbnail',
						action: 'Set youtube video thumbnail',
						description: 'Set a completed DOHOO image as the thumbnail for a YouTube video',
					},
				],
				default: 'publish',
			},
			connectionProperty('YouTube'),
			...mediaSourceProperties({ operations: ['publish'], required: true }),
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				typeOptions: { maxValue: TEXT_LIMITS.youtubeTitle },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['publish'] } },
			},
			{
				displayName: 'Publish Mode',
				name: 'publishMode',
				type: 'options',
				options: [
					{ name: 'Publish Now', value: 'now' },
					{ name: 'Schedule in DOHOO', value: 'dohoo' },
					{ name: 'YouTube Native Schedule', value: 'youtube' },
				],
				default: 'now',
				displayOptions: { show: { operation: ['publish'] } },
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['publish'], publishMode: ['dohoo'] } },
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: 'UTC',
				required: true,
				displayOptions: { show: { operation: ['publish'], publishMode: ['dohoo'] } },
			},
			{
				displayName: 'YouTube Publish At',
				name: 'publishAt',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['publish'], publishMode: ['youtube'] } },
				description: 'YouTube native scheduled publication time; the upload occurs immediately',
			},
			additionalFieldsProperty({
				operations: ['publish'],
				fields: [
					{
						displayName: 'Category ID',
						name: 'category',
						type: 'string',
						default: '22',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						typeOptions: { rows: 6, maxValue: TEXT_LIMITS.youtubeDescription },
						default: '',
					},
					{
						displayName: 'Tags',
						name: 'tags',
						type: 'string',
						default: '',
						placeholder: 'e.g. automation, tutorial, dohoo',
						description: 'Comma-separated YouTube tags',
					},
					{
						displayName: 'Thumbnail URL',
						name: 'thumbnailUrl',
						type: 'string',
						default: '',
						description: 'Optional completed DOHOO image URL for a verified YouTube channel',
					},
					{
						displayName: 'Visibility',
						name: 'visibility',
						type: 'options',
						options: [
							{ name: 'Private', value: 'private' },
							{ name: 'Public', value: 'public' },
							{ name: 'Unlisted', value: 'unlisted' },
						],
						default: 'public',
					},
				],
			}),
			{
				displayName: 'YouTube Video ID',
				name: 'videoId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['setThumbnail'] } },
			},
			{
				displayName: 'Thumbnail URL',
				name: 'existingThumbnailUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['setThumbnail'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await createConnectionLoader(PLATFORM_CODES.youtube).call(this);
			},
		},
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const operation = String(this.getNodeParameter('operation', itemIndex));
			const connectionId = locatorValue(this.getNodeParameter('connectionId', itemIndex));
			if (operation === 'setThumbnail') {
				const videoId = encodeURIComponent(String(this.getNodeParameter('videoId', itemIndex)));
				const thumbnailUrl = await resolveDohooMediaUrl(
					this,
					itemIndex,
					String(this.getNodeParameter('existingThumbnailUrl', itemIndex)),
				);
				return await publish(this, `/api/v2/youtube/thumbnail/${videoId}`, {
					connectionId,
					thumbnailUrl,
				});
			}

			const body: IDataObject = {
				fileUrl: await resolveMediaUrl(this, itemIndex),
				connectionId,
				title: String(this.getNodeParameter('title', itemIndex)),
				description: String(readAdditionalField(this, itemIndex, 'description', '')),
				visibility: String(readAdditionalField(this, itemIndex, 'visibility', 'public')),
				category: String(readAdditionalField(this, itemIndex, 'category', '22')),
			};
			const tags = String(readAdditionalField(this, itemIndex, 'tags', ''))
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean);
			if (tags.length) body.tags = tags;
			const thumbnailUrl = String(readAdditionalField(this, itemIndex, 'thumbnailUrl', ''));
			if (thumbnailUrl)
				body.thumbnail_url = await resolveDohooMediaUrl(this, itemIndex, thumbnailUrl);

			const mode = String(this.getNodeParameter('publishMode', itemIndex));
			if (mode === 'dohoo') {
				const timezone = String(this.getNodeParameter('timezone', itemIndex));
				body.scheduledAt = normalizeScheduledAt(
					String(this.getNodeParameter('scheduledAt', itemIndex)),
					timezone,
				);
				body.timezone = timezone;
			} else if (mode === 'youtube') {
				if (body.visibility !== 'private') {
					throw new NodeOperationError(
						this.getNode(),
						'YouTube native scheduling requires Visibility to be Private',
						{
							itemIndex,
							description:
								'Open Additional Fields, set Visibility to Private, and run the node again.',
						},
					);
				}
				body.publish_at = String(this.getNodeParameter('publishAt', itemIndex));
			}
			return await publish(this, '/api/v2/youtube/publish', body);
		});
	}
}
