import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

const errorMessageKeys = [
	'error',
	'message',
	'errorMessage',
	'error_description',
	'description',
	'detail',
	'details',
	'reason',
	'errors',
] as const;
const maxErrorMessageLength = 2_000;

function messageFromPayload(value: unknown, depth = 0): string | undefined {
	if (depth > 6 || value === null || value === undefined) return undefined;
	if (typeof value === 'string') {
		const message = value.trim();
		if (!message) return undefined;
		if ((message.startsWith('{') || message.startsWith('[')) && message.length <= 50_000) {
			try {
				return messageFromPayload(JSON.parse(message), depth + 1) ?? message;
			} catch {
				return message.slice(0, maxErrorMessageLength);
			}
		}
		return message.slice(0, maxErrorMessageLength);
	}
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) {
		const messages = value
			.map((entry) => messageFromPayload(entry, depth + 1))
			.filter((entry): entry is string => Boolean(entry));
		return messages.length ? messages.join('; ') : undefined;
	}
	if (typeof value !== 'object') return undefined;

	const object = value as Record<string, unknown>;
	for (const key of errorMessageKeys) {
		const message = messageFromPayload(object[key], depth + 1);
		if (message) return message;
	}
	return undefined;
}

function responseDetails(error: Record<string, unknown>): string | undefined {
	const response = error.response as Record<string, unknown> | undefined;
	for (const candidate of [response?.data, response?.body, error.body, error.data]) {
		const message = messageFromPayload(candidate);
		if (message) return message;
	}
	return undefined;
}

function httpCodeFromError(error: Record<string, unknown>): string | undefined {
	const response = error.response as Record<string, unknown> | undefined;
	const code = response?.status ?? response?.statusCode ?? error.statusCode ?? error.httpCode;
	return typeof code === 'number' || typeof code === 'string' ? String(code) : undefined;
}

export function messageFromError(error: unknown): string {
	if (typeof error === 'string') return error;
	if (error !== null && typeof error === 'object') {
		const object = error as Record<string, unknown>;
		const responseMessage = responseDetails(object);
		if (responseMessage) return responseMessage;
		const directMessage = messageFromPayload(object);
		if (directMessage) return directMessage;
	}
	if (error instanceof Error && error.message) return error.message;
	return 'Unknown DOHOO error';
}

export function toNodeError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;

	if (error !== null && typeof error === 'object') {
		const object = error as Record<string, unknown>;
		if (
			object.response !== undefined ||
			object.statusCode !== undefined ||
			object.httpCode !== undefined
		) {
			const message = messageFromError(error);
			const httpCode = httpCodeFromError(object);
			return new NodeApiError(context.getNode(), error as JsonObject, {
				itemIndex,
				message,
				httpCode,
				description: httpCode
					? `DOHOO API returned HTTP ${httpCode}. Review the response message, correct the request, and run the node again.`
					: 'Review the DOHOO response message, correct the request, and run the node again.',
			});
		}
	}

	return new NodeOperationError(context.getNode(), messageFromError(error), {
		itemIndex,
		description:
			'Review the node parameters and the preceding item data, correct the invalid value, and run the node again.',
	});
}
