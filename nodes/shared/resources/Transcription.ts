import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { executeForEachItem } from '../execution';
import { resolveMediaUrl } from '../media';
import { mediaSourceProperties } from '../properties';
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
				options: [{ name: 'Transcribe Video', value: 'transcribe', action: 'Transcribe a video' }],
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
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				placeholder: 'ru',
				description:
					'Optional two-letter ISO-639-1 language code; leave empty for automatic detection',
			},
		],
	};

	async run(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await executeForEachItem(this, async (itemIndex) => {
			const url = await resolveMediaUrl(this, itemIndex);
			if (!url) {
				throw new NodeOperationError(this.getNode(), 'A video URL is required', { itemIndex });
			}
			const body: IDataObject = { url };
			const language = String(this.getNodeParameter('language', itemIndex, '')).toLowerCase();
			if (language && !/^[a-z]{2}$/.test(language)) {
				throw new NodeOperationError(
					this.getNode(),
					'Language must be a two-letter ISO-639-1 code such as ru, en, or uk',
					{ itemIndex },
				);
			}
			if (language) body.language = language;
			return await publish(this, '/api/transcriptions', body);
		});
	}
}
