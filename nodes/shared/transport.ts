import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import { DOHOO_BASE_URL } from './constants';

export type DohooRequestContext = IExecuteFunctions | ILoadOptionsFunctions;

export async function dohooApiRequest<T = IDataObject>(
	context: DohooRequestContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<T> {
	const options: IHttpRequestOptions = {
		baseURL: DOHOO_BASE_URL,
		url: path,
		method,
		json: true,
		timeout: 120_000,
	};

	if (body !== undefined) options.body = body;
	if (qs !== undefined) options.qs = qs;

	return (await context.helpers.httpRequestWithAuthentication.call(
		context,
		'dohooApi',
		options,
	)) as T;
}

export function asDataObject(value: unknown): IDataObject {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as IDataObject;
	}
	return {};
}

export function asDataObjectArray(value: unknown): IDataObject[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is IDataObject =>
			item !== null && typeof item === 'object' && !Array.isArray(item),
	);
}
