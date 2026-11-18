import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { executeForEachItem } from '../execution';
import { additionalFieldsProperty, readAdditionalField } from '../properties';
import { asDataObject, asDataObjectArray, dohooApiRequest } from '../transport';

export class ScheduledPostsResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Scheduled Posts',
		name: 'dohooScheduledPosts',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['input'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'List, inspect, and cancel posts created through the DOHOO scheduler',
		defaults: { name: 'DOHOO Scheduled Posts' },
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
						name: 'Cancel Post',
						value: 'cancel',
						action: 'Cancel a DOHOO scheduled post',
						description: 'Cancel a scheduled job by its DOHOO ID; media and already published posts remain',
					},
					{
						name: 'Get Post',
						value: 'get',
						action: 'Get a DOHOO scheduled post',
						description: 'Read the full details of one scheduled job by its DOHOO ID',
					},
					{
						name: 'List Posts',
						value: 'list',
						action: 'List DOHOO scheduled posts',
						description: 'Retrieve scheduled, published, or failed posts from DOHOO',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Scheduled Post ID',
				name: 'scheduledPostId',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 0,
				required: true,
				description: 'Numeric DOHOO scheduled-job ID from List Posts or a scheduling response, not a social-platform post ID',
				displayOptions: { show: { operation: ['get', 'cancel'] } },
			},
			{
				displayName: 'Confirm Cancellation',
				name: 'confirmCancellation',
				type: 'boolean',
				default: false,
				description: 'Whether the user confirmed cancellation of this job or explicitly requested a change that requires replacing it',
				displayOptions: { show: { operation: ['cancel'] } },
			},
			{
				displayName: 'Period',
				name: 'period',
				type: 'options',
				options: [
					{ name: 'Today', value: 'today' },
					{ name: 'Week', value: 'week' },
					{ name: 'Month', value: 'month' },
					{ name: 'Custom', value: 'custom' },
				],
				default: 'week',
				displayOptions: { show: { operation: ['list'] } },
			},
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['list'], period: ['custom'] } },
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['list'], period: ['custom'] } },
			},
			additionalFieldsProperty({
				operations: ['list'],
				fields: [
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 100 },
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Offset',
						name: 'offset',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
					},
					{
						displayName: 'Platform',
						name: 'platform',
						type: 'string',
						default: '',
						placeholder: 'e.g. instagram',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{ name: 'All', value: 'all' },
							{ name: 'Failed', value: 'failed' },
							{ name: 'Pending', value: 'pending' },
							{ name: 'Published', value: 'published' },
						],
						default: 'pending',
					},
				],
			}),
		],
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const operation = String(this.getNodeParameter('operation', itemIndex));
			if (operation === 'get' || operation === 'cancel') {
				const id = Number(this.getNodeParameter('scheduledPostId', itemIndex));
				if (!Number.isSafeInteger(id) || id <= 0) {
					throw new Error('Scheduled Post ID must be a positive integer');
				}
				if (operation === 'get') {
					return asDataObject(await dohooApiRequest(this, 'GET', `/api/scheduled-posts/${id}`));
				}
				if (this.getNodeParameter('confirmCancellation', itemIndex) !== true) {
					throw new Error('Confirm Cancellation must be enabled before cancelling a scheduled post');
				}
				const response = asDataObject(
					await dohooApiRequest(this, 'DELETE', `/api/scheduled-posts/${id}`),
				);
				return { ...response, success: response.success ?? true, scheduledPostId: id };
			}
			if (operation !== 'list') throw new Error(`Unsupported scheduled posts operation: ${operation}`);
			const period = String(this.getNodeParameter('period', itemIndex));
			const qs: IDataObject = {
				period,
				status: String(readAdditionalField(this, itemIndex, 'status', 'pending')),
				limit: Number(readAdditionalField(this, itemIndex, 'limit', 50)),
				offset: Number(readAdditionalField(this, itemIndex, 'offset', 0)),
			};
			const platform = String(readAdditionalField(this, itemIndex, 'platform', ''));
			if (platform) qs.platform = platform;
			if (period === 'custom') {
				qs.from = String(this.getNodeParameter('from', itemIndex)).slice(0, 10);
				qs.to = String(this.getNodeParameter('to', itemIndex)).slice(0, 10);
			}
			const payload = await dohooApiRequest<unknown>(
				this,
				'GET',
				'/api/scheduled-posts',
				undefined,
				qs,
			);
			const response = asDataObject(payload);
			const data = asDataObject(response.data);
			const postsPayload = [payload, response.posts, response.data, data.posts].find(Array.isArray);
			return asDataObjectArray(postsPayload);
		});
	}
}
