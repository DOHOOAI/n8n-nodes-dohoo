import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { dohooApiRequest, asDataObject, asDataObjectArray } from './transport';

function readConnections(payload: unknown): IDataObject[] {
	if (Array.isArray(payload)) return asDataObjectArray(payload);
	if (payload !== null && typeof payload === 'object') {
		const object = payload as IDataObject;
		return asDataObjectArray(object.connections ?? object.data);
	}
	return [];
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

export async function getPinterestBoards(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const connectionId = String(this.getNodeParameter('connectionId', ''));
	if (!connectionId) return [];
	const payload = await dohooApiRequest<unknown>(
		this,
		'GET',
		`/api/v2/pinterest/boards/${encodeURIComponent(connectionId)}`,
	);
	const object = asDataObject(payload);
	const data = asDataObject(object.data);
	const boardsPayload = [payload, object.boards, object.data, data.boards].find(Array.isArray);
	const boards = asDataObjectArray(boardsPayload);
	return boards
		.map((board) => ({
			name: String(board.name ?? board.title ?? board.id ?? board.boardId),
			value: String(board.boardId ?? board.id),
		}))
		.filter((option) => option.value !== 'undefined');
}
