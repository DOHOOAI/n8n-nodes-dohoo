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
import { addSchedule, publish, readFixedMediaUrls } from '../publication';
import { validatePublicExternalUrl } from '../urlSecurity';

const publishOperations = ['publish', 'publishCarousel'];

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
						name: 'Publish Photo Carousel',
						value: 'publishCarousel',
						action: 'Publish facebook page photo carousel',
						description: 'Publish or schedule two to ten JPEG or PNG photos as one Facebook page post',
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
			fixedMediaUrlsProperty({
				operation: 'publishCarousel',
				minimum: 2,
				maximum: 10,
				description: 'Two to ten ordered public HTTPS JPEG or PNG photo URLs. Each photo must be at most 10,000,000 bytes and 40,000,000 pixels. Keep URLs available until scheduled execution.',
			}),
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
			...schedulingProperties(['publishCarousel']).map((property) => {
				if (property.name === 'scheduledAt') {
					return { ...property, description: 'Future ISO 8601 instant with UTC Z or an explicit offset.' };
				}
				if (property.name === 'timezone') {
					return { ...property, description: 'Display timezone; does not reinterpret Scheduled At.' };
				}
				return property;
			}),
			additionalFieldsProperty({
				operations: publishOperations,
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
			if (operation === 'publishCarousel') {
				const urls = readFixedMediaUrls(this, itemIndex, 2, 10);
				const mediaUrls = await Promise.all(urls.map(async (url) => {
					const validation = validatePublicExternalUrl(url);
					if (!validation.url) throw new Error(validation.error ?? 'Enter a public HTTPS photo URL');
					return validation.url.hostname === 'dohoo.ai' || validation.url.hostname === 'mediastorage.dohoo.ai'
						? await resolveDohooMediaUrl(this, itemIndex, url)
						: url;
				}));
				const body: IDataObject = {
					facebookPageId: connectionId,
					mediaType: 'carousel',
					mediaUrls,
					caption: String(readAdditionalField(this, itemIndex, 'caption', '')),
				};
				if (this.getNodeParameter('publishMode', itemIndex, 'now') === 'schedule') {
					const scheduledAt = String(this.getNodeParameter('scheduledAt', itemIndex));
					if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(scheduledAt) || !Number.isFinite(Date.parse(scheduledAt))) {
						throw new Error('Scheduled At must be an ISO 8601 instant with UTC Z or an explicit offset');
					}
					if (Date.parse(scheduledAt) <= Date.now()) throw new Error('Scheduled At must be in the future');
					body.scheduledAt = new Date(scheduledAt).toISOString();
					body.timezone = String(this.getNodeParameter('timezone', itemIndex, 'UTC'));
				}
				return await publish(this, '/api/v2/facebook/publish', body);
			}
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
