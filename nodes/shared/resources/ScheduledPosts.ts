import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { executeForEachItem } from '../execution';
import { asDataObject, asDataObjectArray, dohooApiRequest } from '../transport';

export class ScheduledPostsResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Scheduled Posts',
		name: 'dohooScheduledPosts',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['input'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'List posts created through the DOHOO scheduler',
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
						name: 'List Posts',
						value: 'list',
						action: 'List DOHOO scheduled posts',
						description: 'Retrieve scheduled, published, or failed posts from DOHOO',
					},
				],
				default: 'list',
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
			},
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: { show: { period: ['custom'] } },
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: { show: { period: ['custom'] } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Pending', value: 'pending' },
					{ name: 'Published', value: 'published' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'All', value: 'all' },
				],
				default: 'pending',
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'string',
				default: '',
				placeholder: 'e.g. instagram',
			},
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
		],
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const period = String(this.getNodeParameter('period', itemIndex));
			const qs: IDataObject = {
				period,
				status: String(this.getNodeParameter('status', itemIndex)),
				limit: Number(this.getNodeParameter('limit', itemIndex)),
				offset: Number(this.getNodeParameter('offset', itemIndex)),
			};
			const platform = String(this.getNodeParameter('platform', itemIndex, ''));
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
