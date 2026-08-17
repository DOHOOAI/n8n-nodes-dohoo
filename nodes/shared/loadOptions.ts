import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';

import { locatorValue } from './locators';
import { dohooApiRequest, asDataObject, asDataObjectArray } from './transport';

function readConnections(payload: unknown): IDataObject[] {
	if (Array.isArray(payload)) return asDataObjectArray(payload);
	const object = asDataObject(payload);
	const data = asDataObject(object.data);
	const connectionsPayload = [object.connections, object.data, data.connections].find(Array.isArray);
	return asDataObjectArray(connectionsPayload);
}

export function createConnectionLoader(allowedPlatforms: readonly string[]) {
	return async function getConnections(
		this: ILoadOptionsFunctions,
	): Promise<INodePropertyOptions[]> {
		const payload = await dohooApiRequest(this, 'GET', '/api/connections/unified');
		return readConnections(payload)
			.filter((connection) => {
				const platform = String(connection.platform ?? '').toLowerCase();
				return allowedPlatforms.includes(platform) && connection.active !== false;
			})
			.map((connection) => {
				const id = connection.connectionId ?? connection.id;
				const accountName =
					connection.platformUsername ??
					connection.username ??
					connection.name ??
					`Connection ${String(id)}`;
				return {
					name: String(accountName),
					value: String(id),
				};
			})
			.filter((option) => option.value !== 'undefined');
	};
}

export function createConnectionSearch(allowedPlatforms: readonly string[]) {
	return async function searchConnections(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const normalizedFilter = filter?.trim().toLowerCase() ?? '';
		const options = await createConnectionLoader(allowedPlatforms).call(this);
		return {
			results: options
				.filter((option) => !normalizedFilter || option.name.toLowerCase().includes(normalizedFilter))
				.map((option) => ({ name: option.name, value: String(option.value) })),
		};
	};
}

export function readPinterestBoards(payload: unknown): IDataObject[] {
	if (Array.isArray(payload)) return asDataObjectArray(payload);
	const object = asDataObject(payload);
	const data = asDataObject(object.data);
	const boardsPayload = [object.boards, object.data, data.boards].find(Array.isArray);
	return asDataObjectArray(boardsPayload);
}

export async function getPinterestBoards(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const connectionId = locatorValue(this.getNodeParameter('connectionId', ''));
	if (!connectionId) return [];
	const payload = await dohooApiRequest<unknown>(
		this,
		'GET',
		`/api/v2/pinterest/boards/${encodeURIComponent(connectionId)}`,
	);
	return readPinterestBoards(payload)
		.map((board) => ({
			name: String(board.name ?? board.title ?? board.id ?? board.boardId),
			value: String(board.boardId ?? board.id),
		}))
		.filter((option) => option.value !== 'undefined');
}

export async function searchPinterestBoards(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const normalizedFilter = filter?.trim().toLowerCase() ?? '';
	const options = await getPinterestBoards.call(this);
	return {
		results: options
			.filter((option) => !normalizedFilter || option.name.toLowerCase().includes(normalizedFilter))
			.map((option) => ({ name: option.name, value: String(option.value) })),
	};
}
