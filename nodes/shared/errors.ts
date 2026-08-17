import type { IExecuteFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export function messageFromError(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === 'string') return error;
	if (error !== null && typeof error === 'object') {
		const object = error as Record<string, unknown>;
		const response = object.response as Record<string, unknown> | undefined;
		const responseData = response?.data as Record<string, unknown> | undefined;
		const directMessage = object.message ?? responseData?.message ?? responseData?.error;
		if (typeof directMessage === 'string') return directMessage;
	}
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
			return new NodeApiError(context.getNode(), error as JsonObject, { itemIndex });
		}
	}

	return new NodeOperationError(context.getNode(), messageFromError(error), { itemIndex });
}
