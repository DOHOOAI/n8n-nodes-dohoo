import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { executeForEachItem } from '../execution';
import { normalizeFileForOutput, resolveFileIdMediaUrl, resolveMedia } from '../media';
import { mediaSourceProperties } from '../properties';
import { asDataObject, asDataObjectArray, dohooApiRequest } from '../transport';

export class MediaResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Media',
		name: 'dohooMedia',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['input', 'output'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Upload and inspect files in the DOHOO media library',
		defaults: { name: 'DOHOO Media' },
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
					{ name: 'Get File URL', value: 'getUrl', action: 'Get a file URL' },
					{ name: 'Get Latest File', value: 'getLatest', action: 'Get the latest file' },
					{ name: 'Get Upload Status', value: 'getStatus', action: 'Get upload status' },
					{ name: 'List Files', value: 'list', action: 'List files' },
					{ name: 'Upload File', value: 'upload', action: 'Upload a file' },
				],
				default: 'upload',
			},
			...mediaSourceProperties({ operations: ['upload'], required: true }),
			{
				displayName: 'File ID',
				name: 'targetFileId',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 0,
				required: true,
				displayOptions: { show: { operation: ['getUrl', 'getStatus'] } },
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['list'] } },
				description: 'Case-insensitive text in the filename, title, or description',
			},
			{
				displayName: 'MIME Type',
				name: 'mimeType',
				type: 'string',
				default: '',
				placeholder: 'image/',
				displayOptions: { show: { operation: ['list'] } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Processing', value: 'processing' },
				],
				default: '',
				displayOptions: { show: { operation: ['list'] } },
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				displayOptions: { show: { operation: ['list'] } },
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100 },
				default: 20,
				displayOptions: { show: { operation: ['list'] } },
			},
		],
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const operation = String(this.getNodeParameter('operation', itemIndex));
			if (operation === 'upload') {
				const media = await resolveMedia(this, itemIndex);
				return { success: true, ...media, readyForPublish: true };
			}
			if (operation === 'getLatest') {
				const response = asDataObject(await dohooApiRequest(this, 'GET', '/api/upload/latest'));
				return await normalizeFileForOutput(this, itemIndex, response);
			}
			if (operation === 'list') {
				const qs: IDataObject = {
					page: Number(this.getNodeParameter('page', itemIndex, 1)),
					pageSize: Number(this.getNodeParameter('pageSize', itemIndex, 20)),
				};
				for (const name of ['search', 'mimeType', 'status']) {
					const value = String(this.getNodeParameter(name, itemIndex, ''));
					if (value) qs[name] = value;
				}
				const response = asDataObject(
					await dohooApiRequest(this, 'GET', '/api/upload/files/search', undefined, qs),
				);
				return await Promise.all(
					asDataObjectArray(response.files).map(
						async (file) => await normalizeFileForOutput(this, itemIndex, file),
					),
				);
			}

			const fileId = Number(this.getNodeParameter('targetFileId', itemIndex));
			if (operation === 'getStatus') {
				const response = asDataObject(
					await dohooApiRequest(this, 'GET', `/api/upload/status/${fileId}`),
				);
				return {
					...response,
					file: await normalizeFileForOutput(this, itemIndex, response),
				};
			}
			const fileUrl = await resolveFileIdMediaUrl(this, itemIndex, fileId);
			return { success: true, fileId, fileUrl, readyForPublish: true };
		});
	}
}
