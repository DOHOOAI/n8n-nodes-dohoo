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
import { createConnectionLoader, getPinterestBoards, readPinterestBoards } from '../loadOptions';
import { resolveMediaUrl } from '../media';
import {
	connectionProperty,
	mediaSourceProperties,
	schedulingProperties,
} from '../properties';
import { addSchedule, publish } from '../publication';
import { dohooApiRequest } from '../transport';

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
					{
						name: 'Publish Pin',
						value: 'publish',
						action: 'Publish pinterest pin',
						description: 'Publish an image or video pin to a selected Pinterest board',
					},
					{
						name: 'List Boards',
						value: 'listBoards',
						action: 'List pinterest boards',
						description: 'Retrieve boards available to the selected Pinterest account',
					},
					{
						name: 'Create Board',
						value: 'createBoard',
						action: 'Create pinterest board',
						description: 'Create a public or secret board for the selected Pinterest account',
					},
				],
				default: 'publish',
			},
			connectionProperty('Pinterest'),
			{
				displayName: 'Board',
				name: 'boardId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['connectionId.value'],
				},
				displayOptions: { show: { operation: ['publish'] } },
				description: 'Pinterest board where the pin will be published',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a board...',
						typeOptions: {
							searchListMethod: 'searchBoards',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 1009721247645824856',
					},
				],
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
			const connectionId = locatorValue(this.getNodeParameter('connectionId', itemIndex));
			if (operation === 'listBoards') {
				const response = await dohooApiRequest<unknown>(
						this,
						'GET',
						`/api/v2/pinterest/boards/${encodeURIComponent(connectionId)}`,
				);
				return readPinterestBoards(response);
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
				boardId: locatorValue(this.getNodeParameter('boardId', itemIndex)),
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
