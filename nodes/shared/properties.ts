import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

export function additionalFieldsProperty(options: {
	operations: string[];
	fields: INodeProperties[];
	displayName?: string;
}): INodeProperties {
	return {
		displayName: options.displayName ?? 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: options.operations } },
		options: [...options.fields].sort((left, right) =>
			left.displayName.localeCompare(right.displayName),
		),
	};
}

export function readAdditionalField<T>(
	context: IExecuteFunctions,
	itemIndex: number,
	name: string,
	defaultValue: T,
): T {
	const additionalFields = context.getNodeParameter(
		'additionalFields',
		itemIndex,
		{},
	) as IDataObject;
	if (Object.prototype.hasOwnProperty.call(additionalFields, name)) {
		return additionalFields[name] as T;
	}

	// Preserve workflows created before optional values moved into Additional Fields.
	return context.getNodeParameter(name, itemIndex, defaultValue) as T;
}

export function connectionProperty(label: string): INodeProperties {
	return {
		displayName: `${label} Account`,
		name: 'connectionId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: `${label} account connected to DOHOO`,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: `Select a ${label} account...`,
				typeOptions: {
					searchListMethod: 'searchConnections',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 928',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '.+',
							errorMessage: 'Enter a valid DOHOO connection ID',
						},
					},
				],
			},
		],
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
			placeholder: 'e.g. https://mediastorage.dohoo.ai/file/dohoo-video-storage/example.mp4',
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
			placeholder: 'e.g. https://example.com/video.mp4',
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
			placeholder: 'e.g. Europe/Kiev',
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
						placeholder: 'e.g. https://mediastorage.dohoo.ai/file/dohoo-video-storage/image.jpg',
						description: `Public HTTPS URL (${options.minimum}–${options.maximum} items total)`,
					},
				],
			},
		],
	};
}
