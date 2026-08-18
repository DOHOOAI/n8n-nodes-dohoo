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
import { locatorValue } from '../locators';
import { createConnectionLoader } from '../loadOptions';
import { resolveDohooMediaUrl, resolveMediaUrl } from '../media';
import {
	additionalFieldsProperty,
	connectionProperty,
	fixedMediaUrlsProperty,
	mediaSourceProperties,
	readAdditionalField,
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
					{
						name: 'Publish Video',
						value: 'publishVideo',
						action: 'Publish tiktok video',
						description: 'Publish or send a video to drafts for the selected TikTok account',
					},
					{
						name: 'Publish Photo Carousel',
						value: 'publishCarousel',
						action: 'Publish tiktok photo carousel',
						description: 'Publish two to thirty-five images as a TikTok photo carousel',
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
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.tiktokCarouselDescription },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['publishCarousel'] } },
				description: 'Required TikTok photo-carousel caption',
			},
			...schedulingProperties(['publishVideo', 'publishCarousel']),
			additionalFieldsProperty({
				operations: ['publishVideo'],
				fields: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						typeOptions: { rows: 5, maxValue: TEXT_LIMITS.tiktokVideoDescription },
						default: '',
						description: 'Optional TikTok video caption',
					},
					{
						displayName: 'Disable Comments',
						name: 'disableComment',
						type: 'boolean',
						default: false,
						description: 'Whether to prevent viewers from commenting on the TikTok video',
					},
					{
						displayName: 'Disable Duet',
						name: 'disableDuet',
						type: 'boolean',
						default: false,
						description: 'Whether to prevent viewers from creating duets with the TikTok video',
					},
					{
						displayName: 'Disable Stitch',
						name: 'disableStitch',
						type: 'boolean',
						default: false,
						description: 'Whether to prevent viewers from stitching the TikTok video',
					},
					{
						displayName: 'Send to Draft',
						name: 'sendToDraft',
						type: 'boolean',
						default: false,
						description: 'Whether to send the TikTok video to drafts instead of publishing it',
					},
					{
						displayName: 'Visibility',
						name: 'visibility',
						type: 'options',
						options: visibilityOptions,
						default: 'SELF_ONLY',
					},
				],
			}),
			additionalFieldsProperty({
				operations: ['publishCarousel'],
				fields: [
					{
						displayName: 'Auto-Add Music',
						name: 'autoMusic',
						type: 'boolean',
						default: false,
						description: 'Whether TikTok should automatically add music to the photo carousel',
					},
					{
						displayName: 'Cover Image Index',
						name: 'coverIndex',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
					},
					{
						displayName: 'Visibility',
						name: 'visibility',
						type: 'options',
						options: visibilityOptions,
						default: 'SELF_ONLY',
					},
				],
			}),
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
			const connectionId = locatorValue(this.getNodeParameter('connectionId', itemIndex));
			const description = String(
				operation === 'publishCarousel'
					? this.getNodeParameter('description', itemIndex)
					: readAdditionalField(this, itemIndex, 'description', ''),
			);
			const visibility = String(readAdditionalField(this, itemIndex, 'visibility', 'SELF_ONLY'));

			if (operation === 'publishCarousel') {
				const body: IDataObject = {
					connectionId,
					description,
					visibility,
					autoMusic: Boolean(readAdditionalField(this, itemIndex, 'autoMusic', false)),
					coverIndex: Number(readAdditionalField(this, itemIndex, 'coverIndex', 0)),
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
					[connectionId]: Boolean(readAdditionalField(this, itemIndex, 'disableComment', false)),
				},
				tiktokDisableDuet: {
					[connectionId]: Boolean(readAdditionalField(this, itemIndex, 'disableDuet', false)),
				},
				tiktokDisableStitch: {
					[connectionId]: Boolean(readAdditionalField(this, itemIndex, 'disableStitch', false)),
				},
				tiktokSendToDraft: {
					[connectionId]: Boolean(readAdditionalField(this, itemIndex, 'sendToDraft', false)),
				},
			};
			addSchedule(this, itemIndex, body);
			return await publishThroughSocialPost(this, itemIndex, connectionId, body);
		});
	}
}
