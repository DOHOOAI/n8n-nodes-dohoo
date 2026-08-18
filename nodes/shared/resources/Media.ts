import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { executeForEachItem } from '../execution';
import { normalizeFileForOutput, resolveFileIdMediaUrl, resolveMedia } from '../media';
import {
	additionalFieldsProperty,
	mediaSourceProperties,
	readAdditionalField,
} from '../properties';
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
					{
						name: 'Get File URL',
						value: 'getUrl',
						action: 'Get DOHOO file URL',
						description: 'Resolve a completed DOHOO file to its canonical public URL',
					},
					{
						name: 'Get Latest File',
						value: 'getLatest',
						action: 'Get latest DOHOO file',
						description: 'Retrieve the most recently uploaded file from DOHOO media storage',
					},
					{
						name: 'Get Upload Status',
						value: 'getStatus',
						action: 'Get DOHOO upload status',
						description: 'Retrieve processing status and metadata for a DOHOO file',
					},
					{
						name: 'List Files',
						value: 'list',
						action: 'List DOHOO files',
						description: 'Retrieve files from the DOHOO media library using optional filters',
					},
					{
						name: 'Upload File',
						value: 'upload',
						action: 'Upload DOHOO file',
						description: 'Upload binary data or copy a public HTTPS file into DOHOO',
					},
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
			additionalFieldsProperty({
				operations: ['list'],
				fields: [
					{
						displayName: 'MIME Type',
						name: 'mimeType',
						type: 'string',
						default: '',
						placeholder: 'e.g. image/',
					},
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						typeOptions: { minValue: 1 },
						default: 1,
					},
					{
						displayName: 'Page Size',
						name: 'pageSize',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 100 },
						default: 20,
					},
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
						description: 'Case-insensitive text in the filename, title, or description',
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
					},
				],
			}),
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
					page: Number(readAdditionalField(this, itemIndex, 'page', 1)),
					pageSize: Number(readAdditionalField(this, itemIndex, 'pageSize', 20)),
				};
				for (const name of ['search', 'mimeType', 'status']) {
					const value = String(readAdditionalField(this, itemIndex, name, ''));
					if (value) qs[name] = value;
				}
				const payload = await dohooApiRequest<unknown>(
					this,
					'GET',
					'/api/upload/files/search',
					undefined,
					qs,
				);
				const response = asDataObject(payload);
				const data = asDataObject(response.data);
				const filesPayload = [payload, response.files, response.data, data.files].find(Array.isArray);
				return await Promise.all(
					asDataObjectArray(filesPayload).map(
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
