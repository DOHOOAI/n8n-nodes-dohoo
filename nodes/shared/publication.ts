import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { asDataObject, asDataObjectArray, dohooApiRequest } from './transport';

export function addSchedule(
	context: IExecuteFunctions,
	itemIndex: number,
	body: IDataObject,
): void {
	if (context.getNodeParameter('publishMode', itemIndex, 'now') !== 'schedule') return;
	const timezone = String(context.getNodeParameter('timezone', itemIndex, 'UTC'));
	body.scheduledAt = normalizeScheduledAt(
		String(context.getNodeParameter('scheduledAt', itemIndex)),
		timezone,
	);
	body.timezone = timezone;
}

export function normalizeScheduledAt(value: string, timezone: string): string {
	if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return value;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(date);
	const read = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? '';
	return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}:${read('second')}`;
}

export async function publish(
	context: IExecuteFunctions,
	path: string,
	body: IDataObject,
): Promise<IDataObject> {
	const response = asDataObject(await dohooApiRequest(context, 'POST', path, body));
	if (response.success === false || response.blocked === true) {
		throw new Error(
			String(
				response.error ??
					response.errorMessage ??
					response.message ??
					'DOHOO rejected the operation',
			),
		);
	}
	return response;
}

export async function publishThroughSocialPost(
	context: IExecuteFunctions,
	itemIndex: number,
	connectionId: string,
	body: IDataObject,
): Promise<IDataObject> {
	const response = asDataObject(
		await dohooApiRequest(context, 'POST', '/api/social/post', {
			...body,
			platforms: [connectionId],
		}),
	);
	if (response.success === false) {
		throw new NodeOperationError(
			context.getNode(),
			String(response.error ?? response.message ?? 'DOHOO rejected the publication'),
			{ itemIndex },
		);
	}
	const results = asDataObjectArray(response.results);
	const result =
		results.find((entry) => String(entry.connectionId ?? entry.id) === connectionId) ?? results[0];

	if (!result) {
		throw new NodeOperationError(
			context.getNode(),
			'DOHOO returned no per-account result for this publication',
			{ itemIndex },
		);
	}
	if (result.success === false) {
		throw new NodeOperationError(
			context.getNode(),
			String(result.error ?? result.message ?? 'The social platform rejected the publication'),
			{ itemIndex },
		);
	}

	return { ...response, result };
}

export function readFixedMediaUrls(
	context: IExecuteFunctions,
	itemIndex: number,
	minimum: number,
	maximum: number,
): string[] {
	const collection = context.getNodeParameter('mediaItems', itemIndex, {}) as IDataObject;
	const entries = asDataObjectArray(collection.items);
	const urls = entries.map((entry) => String(entry.url ?? '')).filter(Boolean);
	if (urls.length < minimum || urls.length > maximum) {
		throw new NodeOperationError(
			context.getNode(),
			`Provide between ${minimum} and ${maximum} media URLs`,
			{ itemIndex },
		);
	}
	return urls;
}
