import type { INodeProperties } from 'n8n-workflow';

export function connectionProperty(label: string): INodeProperties {
	return {
		displayName: `${label} Account Name or ID`,
		name: 'connectionId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getConnections' },
		default: '',
		required: true,
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	};
}

export function mediaSourceProperties(options: {
	operations: string[];
	required: boolean;
}): INodeProperties[] {
	const sourceOptions = [
		{ name: 'Input Data Field', value: 'binary' },
		{ name: 'DOHOO File ID', value: 'fileId' },
		{ name: 'DOHOO Media URL', value: 'dohooUrl' },
		{ name: 'External URL', value: 'externalUrl' },
	];
	if (!options.required) sourceOptions.unshift({ name: 'None', value: 'none' });

	const visibleForOperations = { operation: options.operations };
	const mediaSourceProperty: INodeProperties = options.required
		? {
				displayName: 'Media Source',
				name: 'mediaSource',
				type: 'options',
				options: sourceOptions,
				default: 'binary',
				required: true,
				displayOptions: { show: visibleForOperations },
				description: 'Where the media file should be read from',
			}
		: {
				displayName: 'Media Source',
				name: 'mediaSource',
				type: 'options',
				options: sourceOptions,
				default: 'none',
				required: true,
				displayOptions: { show: visibleForOperations },
				description: 'Where the media file should be read from',
			};
	return [
		mediaSourceProperty,
		{
			displayName: 'Input Data Field Name',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			displayOptions: {
				show: { ...visibleForOperations, mediaSource: ['binary'] },
			},
			description: 'Name of the input field containing the binary file to upload',
		},
		{
			displayName: 'DOHOO File ID',
			name: 'fileId',
			type: 'number',
			default: 0,
			required: true,
			typeOptions: { minValue: 1 },
			displayOptions: {
				show: { ...visibleForOperations, mediaSource: ['fileId'] },
			},
			description: 'Numeric ID of an existing completed file in the DOHOO media library',
		},
		{
			displayName: 'DOHOO Media URL',
			name: 'mediaUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://mediastorage.dohoo.ai/file/dohoo-video-storage/example.mp4',
			displayOptions: {
				show: { ...visibleForOperations, mediaSource: ['dohooUrl'] },
			},
			description: 'Canonical public URL of an existing file in DOHOO media storage',
		},
		{
			displayName: 'External File URL',
			name: 'externalUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://example.com/video.mp4',
			displayOptions: {
				show: { ...visibleForOperations, mediaSource: ['externalUrl'] },
			},
			description: 'Public HTTPS URL that n8n should copy into the DOHOO media library',
		},
	];
}

export function schedulingProperties(operations: string[]): INodeProperties[] {
	return [
		{
			displayName: 'Publish Mode',
			name: 'publishMode',
			type: 'options',
			options: [
				{ name: 'Publish Now', value: 'now' },
				{ name: 'Schedule', value: 'schedule' },
			],
			default: 'now',
			displayOptions: { show: { operation: operations } },
			description: 'Whether to publish immediately or create a scheduled publication',
		},
		{
			displayName: 'Scheduled At',
			name: 'scheduledAt',
			type: 'dateTime',
			default: '',
			required: true,
			displayOptions: {
				show: { operation: operations, publishMode: ['schedule'] },
			},
			description: 'Future date and time when DOHOO should publish the content',
		},
		{
			displayName: 'Timezone',
			name: 'timezone',
			type: 'string',
			default: 'UTC',
			required: true,
			placeholder: 'Europe/Kiev',
			displayOptions: {
				show: { operation: operations, publishMode: ['schedule'] },
			},
			description: 'IANA timezone used to interpret the scheduled date and time',
		},
	];
}

export function fixedMediaUrlsProperty(options: {
	operation: string;
	minimum: number;
	maximum: number;
	description: string;
}): INodeProperties {
	return {
		displayName: 'Media Items',
		name: 'mediaItems',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, minRequiredFields: options.minimum },
		default: {},
		required: true,
		placeholder: 'Add Media URL',
		displayOptions: { show: { operation: [options.operation] } },
		description: options.description,
		options: [
			{
				displayName: 'Media',
				name: 'items',
				values: [
					{
						displayName: 'Media URL',
						name: 'url',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'https://mediastorage.dohoo.ai/file/dohoo-video-storage/image.jpg',
						description: `Public HTTPS URL (${options.minimum}–${options.maximum} items total)`,
					},
				],
			},
		],
	};
}
