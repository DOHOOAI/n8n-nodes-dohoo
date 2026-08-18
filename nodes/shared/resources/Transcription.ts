import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { executeForEachItem } from '../execution';
import { resolveMediaUrl } from '../media';
import {
	additionalFieldsProperty,
	mediaSourceProperties,
	readAdditionalField,
} from '../properties';
import { publish } from '../publication';

export class TranscriptionResource {
	definition: INodeTypeDescription = {
		displayName: 'DOHOO Transcription',
		name: 'dohooTranscription',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		...{ group: ['transform'] },
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Transcribe a video from the DOHOO media library',
		defaults: { name: 'DOHOO Transcription' },
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
						name: 'Transcribe Video',
						value: 'transcribe',
						action: 'Transcribe DOHOO video',
						description: 'Convert speech in a DOHOO media-library video into text',
					},
				],
				default: 'transcribe',
			},
			{
				displayName:
					'This operation consumes your DOHOO subscription transcription allowance and is never retried automatically.',
				name: 'allowanceNotice',
				type: 'notice',
				default: '',
			},
			...mediaSourceProperties({ operations: ['transcribe'], required: true }),
			additionalFieldsProperty({
				operations: ['transcribe'],
				fields: [
					{
						displayName: 'Language',
						name: 'language',
						type: 'string',
						default: '',
						placeholder: 'e.g. ru',
						description:
							'Optional two-letter ISO-639-1 language code; leave empty for automatic detection',
					},
				],
			}),
		],
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const url = await resolveMediaUrl(this, itemIndex);
			if (!url) {
				throw new NodeOperationError(this.getNode(), 'A video URL is required', {
					itemIndex,
					description: 'Select a video in Media Source and run the transcription again.',
				});
			}
			const body: IDataObject = { url };
			const language = String(readAdditionalField(this, itemIndex, 'language', '')).toLowerCase();
			if (language && !/^[a-z]{2}$/.test(language)) {
				throw new NodeOperationError(
					this.getNode(),
					'Language must be a two-letter ISO-639-1 code such as ru, en, or uk',
					{
						itemIndex,
						description:
							'Enter a supported two-letter language code or leave Language empty for automatic detection.',
					},
				);
			}
			if (language) body.language = language;
			return await publish(this, '/api/transcriptions', body);
		});
	}
}
