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
import { createConnectionLoader, getPinterestBoards } from '../loadOptions';
import { resolveMediaUrl } from '../media';
import {
	connectionProperty,
	mediaSourceProperties,
	schedulingProperties,
} from '../properties';
import { addSchedule, publish } from '../publication';
import { asDataObject, asDataObjectArray, dohooApiRequest } from '../transport';

export class PinterestResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Pinterest',
		name: 'dohooPinterest',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Publish pins and manage Pinterest boards through DOHOO',
		defaults: { name: 'DOHOO Pinterest' },
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
					{ name: 'Publish Pin', value: 'publish', action: 'Publish a pin' },
					{ name: 'List Boards', value: 'listBoards', action: 'List boards' },
					{ name: 'Create Board', value: 'createBoard', action: 'Create a board' },
				],
				default: 'publish',
			},
			connectionProperty('Pinterest'),
			{
				displayName: 'Board Name or ID',
				name: 'boardId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getBoards',
					loadOptionsDependsOn: ['connectionId'],
				},
				default: '',
				required: true,
				displayOptions: { show: { operation: ['publish'] } },
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			...mediaSourceProperties({ operations: ['publish'], required: true }),
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				typeOptions: { maxValue: TEXT_LIMITS.pinterestTitle },
				default: '',
				displayOptions: { show: { operation: ['publish'] } },
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 5, maxValue: TEXT_LIMITS.pinterestDescription },
				default: '',
				displayOptions: { show: { operation: ['publish'] } },
				description: 'Pin description; supports hashtags',
			},
			{
				displayName: 'Destination Link',
				name: 'link',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['publish'] } },
			},
			{
				displayName: 'Alt Text',
				name: 'altText',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['publish'] } },
			},
			{
				displayName: 'Board Name',
				name: 'boardName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['createBoard'] } },
			},
			{
				displayName: 'Board Description',
				name: 'boardDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['createBoard'] } },
			},
			{
				displayName: 'Privacy',
				name: 'privacy',
				type: 'options',
				options: [
					{ name: 'Public', value: 'PUBLIC' },
					{ name: 'Secret', value: 'SECRET' },
				],
				default: 'PUBLIC',
				displayOptions: { show: { operation: ['createBoard'] } },
			},
			...schedulingProperties(['publish']),
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await createConnectionLoader(PLATFORM_CODES.pinterest).call(this);
			},
			async getBoards(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await getPinterestBoards.call(this);
			},
		},
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const operation = String(this.getNodeParameter('operation', itemIndex));
			const connectionId = String(this.getNodeParameter('connectionId', itemIndex));
			if (operation === 'listBoards') {
				const response = asDataObject(
					await dohooApiRequest(
						this,
						'GET',
						`/api/v2/pinterest/boards/${encodeURIComponent(connectionId)}`,
					),
				);
				return asDataObjectArray(response.boards);
			}
			if (operation === 'createBoard') {
				return await publish(this, `/api/v2/pinterest/boards/${encodeURIComponent(connectionId)}`, {
					name: String(this.getNodeParameter('boardName', itemIndex)),
					description: String(this.getNodeParameter('boardDescription', itemIndex, '')),
					privacy: String(this.getNodeParameter('privacy', itemIndex)),
				});
			}

			const body: IDataObject = {
				connectionId,
				boardId: String(this.getNodeParameter('boardId', itemIndex)),
				fileUrl: await resolveMediaUrl(this, itemIndex),
				title: String(this.getNodeParameter('title', itemIndex, '')),
				description: String(this.getNodeParameter('description', itemIndex, '')),
			};
			const link = String(this.getNodeParameter('link', itemIndex, ''));
			const altText = String(this.getNodeParameter('altText', itemIndex, ''));
			if (link) body.link = link;
			if (altText) body.altText = altText;
			addSchedule(this, itemIndex, body);
			return await publish(this, '/api/v2/pinterest/publish', body);
		});
	}
}
