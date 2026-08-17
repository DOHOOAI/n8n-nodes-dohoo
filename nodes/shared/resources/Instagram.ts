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
	connectionProperty,
	fixedMediaUrlsProperty,
	mediaSourceProperties,
	schedulingProperties,
} from '../properties';
import { addSchedule, publish, readFixedMediaUrls } from '../publication';

const publishOperations = ['publish', 'publishCarousel'];

export class InstagramResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Instagram',
		name: 'dohooInstagram',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Publish or schedule Instagram content through DOHOO',
		defaults: { name: 'DOHOO Instagram' },
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
						name: 'Publish Media',
						value: 'publish',
						action: 'Publish instagram media',
						description: 'Publish an image or video as an Instagram post, reel, or story',
					},
					{
						name: 'Publish Carousel',
						value: 'publishCarousel',
						action: 'Publish instagram carousel',
						description: 'Publish two to ten images as an Instagram carousel',
					},
				],
				default: 'publish',
			},
			connectionProperty('Instagram'),
			...mediaSourceProperties({ operations: ['publish'], required: true }),
			fixedMediaUrlsProperty({
				operation: 'publishCarousel',
				minimum: 2,
				maximum: 10,
				description: 'Two to ten completed JPEG images from the DOHOO media library',
			}),
			{
				displayName: 'Media Type',
				name: 'mediaType',
				type: 'options',
				options: [
					{ name: 'Photo', value: 'photo' },
					{ name: 'Video', value: 'video' },
				],
				default: 'photo',
				displayOptions: { show: { operation: ['publish'] } },
			},
			{
				displayName: 'Placement',
				name: 'contentType',
				type: 'options',
				options: [
					{ name: 'Post', value: 'post' },
					{ name: 'Reel', value: 'reels' },
					{ name: 'Reel and Story', value: 'reels_and_story' },
					{ name: 'Story', value: 'story' },
				],
				default: 'post',
				displayOptions: { show: { operation: ['publish'] } },
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.instagramCaption },
				default: '',
				description: `Instagram caption (maximum ${TEXT_LIMITS.instagramCaption} characters)`,
			},
			...schedulingProperties(publishOperations),
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await createConnectionLoader(PLATFORM_CODES.instagram).call(this);
			},
		},
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const operation = String(this.getNodeParameter('operation', itemIndex));
			const connectionId = locatorValue(this.getNodeParameter('connectionId', itemIndex));
			const body: IDataObject = {
				instagramAccountId: connectionId,
				caption: String(this.getNodeParameter('caption', itemIndex, '')),
			};

			if (operation === 'publishCarousel') {
				const urls = readFixedMediaUrls(this, itemIndex, 2, 10);
				body.contentType = 'carousel';
				body.mediaUrls = await Promise.all(
					urls.map(async (url) => await resolveDohooMediaUrl(this, itemIndex, url)),
				);
			} else {
				body.fileUrl = await resolveMediaUrl(this, itemIndex);
				body.mediaType = String(this.getNodeParameter('mediaType', itemIndex));
				body.contentType = String(this.getNodeParameter('contentType', itemIndex));
			}
			addSchedule(this, itemIndex, body);
			return await publish(this, '/api/v2/instagram/publish', body);
		});
	}
}
