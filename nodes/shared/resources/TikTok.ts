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
import { resolveDohooMediaUrl, resolveMediaUrl } from '../media';
import {
	connectionProperty,
	fixedMediaUrlsProperty,
	mediaSourceProperties,
	schedulingProperties,
} from '../properties';
import {
	addSchedule,
	publish,
	publishThroughSocialPost,
	readFixedMediaUrls,
} from '../publication';

const visibilityOptions = [
	{ name: 'Everyone', value: 'PUBLIC_TO_EVERYONE' },
	{ name: 'Followers', value: 'FOLLOWER_OF_ACTIVE_USER' },
	{ name: 'Friends', value: 'MUTUAL_FOLLOW_FRIENDS' },
	{ name: 'Only Me', value: 'SELF_ONLY' },
];

export class TikTokResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO TikTok',
		name: 'dohooTikTok',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Publish or schedule TikTok videos and photo carousels through DOHOO',
		defaults: { name: 'DOHOO TikTok' },
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
					{ name: 'Publish Video', value: 'publishVideo', action: 'Publish a video' },
					{
						name: 'Publish Photo Carousel',
						value: 'publishCarousel',
						action: 'Publish a photo carousel',
					},
				],
				default: 'publishVideo',
			},
			connectionProperty('TikTok'),
			...mediaSourceProperties({ operations: ['publishVideo'], required: true }),
			fixedMediaUrlsProperty({
				operation: 'publishCarousel',
				minimum: 2,
				maximum: 35,
				description: 'Two to 35 completed JPEG or PNG images from the DOHOO media library',
			}),
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.tiktokVideoDescription },
				default: '',
				displayOptions: { show: { operation: ['publishVideo'] } },
				description: 'Optional TikTok video caption',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.tiktokCarouselDescription },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['publishCarousel'] } },
				description: 'Required TikTok photo-carousel caption',
			},
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				options: visibilityOptions,
				default: 'SELF_ONLY',
			},
			{
				displayName: 'Disable Comments',
				name: 'disableComment',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['publishVideo'] } },
			},
			{
				displayName: 'Disable Duet',
				name: 'disableDuet',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['publishVideo'] } },
			},
			{
				displayName: 'Disable Stitch',
				name: 'disableStitch',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['publishVideo'] } },
			},
			{
				displayName: 'Send to Draft',
				name: 'sendToDraft',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['publishVideo'] } },
			},
			{
				displayName: 'Auto-Add Music',
				name: 'autoMusic',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['publishCarousel'] } },
			},
			{
				displayName: 'Cover Image Index',
				name: 'coverIndex',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				displayOptions: { show: { operation: ['publishCarousel'] } },
			},
			...schedulingProperties(['publishVideo', 'publishCarousel']),
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await createConnectionLoader(PLATFORM_CODES.tiktok).call(this);
			},
		},
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const operation = String(this.getNodeParameter('operation', itemIndex));
			const connectionId = String(this.getNodeParameter('connectionId', itemIndex));
			const description = String(this.getNodeParameter('description', itemIndex));
			const visibility = String(this.getNodeParameter('visibility', itemIndex));

			if (operation === 'publishCarousel') {
				const body: IDataObject = {
					connectionId,
					description,
					visibility,
					autoMusic: Boolean(this.getNodeParameter('autoMusic', itemIndex)),
					coverIndex: Number(this.getNodeParameter('coverIndex', itemIndex)),
					mediaUrls: await Promise.all(
						readFixedMediaUrls(this, itemIndex, 2, 35).map(
							async (url) => await resolveDohooMediaUrl(this, itemIndex, url),
						),
					),
				};
				addSchedule(this, itemIndex, body);
				return await publish(this, '/api/v2/tiktok/publish', body);
			}

			const body: IDataObject = {
				fileUrl: await resolveMediaUrl(this, itemIndex),
				description,
				tiktokVisibility: { [connectionId]: visibility },
				tiktokDisableComment: {
					[connectionId]: Boolean(this.getNodeParameter('disableComment', itemIndex)),
				},
				tiktokDisableDuet: {
					[connectionId]: Boolean(this.getNodeParameter('disableDuet', itemIndex)),
				},
				tiktokDisableStitch: {
					[connectionId]: Boolean(this.getNodeParameter('disableStitch', itemIndex)),
				},
				tiktokSendToDraft: {
					[connectionId]: Boolean(this.getNodeParameter('sendToDraft', itemIndex)),
				},
			};
			addSchedule(this, itemIndex, body);
			return await publishThroughSocialPost(this, itemIndex, connectionId, body);
		});
	}
}
