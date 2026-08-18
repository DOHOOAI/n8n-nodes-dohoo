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
import { resolveMediaUrl } from '../media';
import {
	additionalFieldsProperty,
	connectionProperty,
	mediaSourceProperties,
	readAdditionalField,
	schedulingProperties,
} from '../properties';
import { addSchedule, publish } from '../publication';

export class FacebookResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Facebook',
		name: 'dohooFacebook',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Publish or schedule Facebook content through DOHOO',
		defaults: { name: 'DOHOO Facebook' },
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
						action: 'Publish facebook post',
						description: 'Publish text, an image, or a video to a Facebook page',
					},
					{
						name: 'Publish Story',
						value: 'publishStory',
						action: 'Publish facebook story',
						description: 'Publish an image or video as a Facebook page story',
					},
				],
				default: 'publish',
			},
			connectionProperty('Facebook'),
			...mediaSourceProperties({ operations: ['publish'], required: false }),
			...mediaSourceProperties({ operations: ['publishStory'], required: true }),
			{
				displayName: 'Media Type',
				name: 'mediaType',
				type: 'options',
				options: [
					{ name: 'Photo', value: 'photo' },
					{ name: 'Text', value: 'text' },
					{ name: 'Video', value: 'video' },
				],
				default: 'photo',
				displayOptions: {
					show: { operation: ['publish'] },
					hide: { mediaSource: ['none'] },
				},
			},
			{
				displayName: 'Story Media Type',
				name: 'storyMediaType',
				type: 'options',
				options: [
					{ name: 'Photo', value: 'photo' },
					{ name: 'Video', value: 'video' },
				],
				default: 'photo',
				displayOptions: { show: { operation: ['publishStory'] } },
			},
			...schedulingProperties(['publish']),
			additionalFieldsProperty({
				operations: ['publish'],
				fields: [
					{
						displayName: 'Caption',
						name: 'caption',
						type: 'string',
						typeOptions: { rows: 5, maxValue: TEXT_LIMITS.facebookCaption },
						default: '',
					},
				],
			}),
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await createConnectionLoader(PLATFORM_CODES.facebook).call(this);
			},
		},
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const operation = String(this.getNodeParameter('operation', itemIndex));
			const connectionId = locatorValue(this.getNodeParameter('connectionId', itemIndex));
			const mediaUrl = await resolveMediaUrl(this, itemIndex);
			if (operation === 'publishStory') {
				return await publish(this, '/api/v1/facebook/publish/story', {
					pageId: connectionId,
					mediaUrl,
					mediaType: String(this.getNodeParameter('storyMediaType', itemIndex)),
				});
			}

			const requestedMediaType = mediaUrl
				? String(this.getNodeParameter('mediaType', itemIndex))
				: 'text';
			const body: IDataObject = {
				facebookPageId: connectionId,
				caption: String(readAdditionalField(this, itemIndex, 'caption', '')),
				// Older workflows may still contain the removed `reel` option. The DOHOO API
				// accepts Facebook media as photo, video, or text, so preserve compatibility.
				mediaType: requestedMediaType === 'reel' ? 'video' : requestedMediaType,
			};
			if (mediaUrl) body.fileUrl = mediaUrl;
			addSchedule(this, itemIndex, body);
			return await publish(this, '/api/v2/facebook/publish', body);
		});
	}
}
