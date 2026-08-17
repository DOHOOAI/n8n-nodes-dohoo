import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { messageFromError, toNodeError } from './errors';

export async function executeForEachItem(
	context: IExecuteFunctions,
	handler: (itemIndex: number) => Promise<IDataObject | IDataObject[]>,
): Promise<INodeExecutionData[][]> {
	const items = context.getInputData();
	const returnData: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const result = await handler(itemIndex);
			const outputItems = Array.isArray(result) ? result : [result];
			for (const outputItem of outputItems) {
				returnData.push({
					json: outputItem,
					pairedItem: { item: itemIndex },
				});
			}
		} catch (error) {
			if (!context.continueOnFail()) throw toNodeError(context, error, itemIndex);
			returnData.push({
				json: { success: false, error: messageFromError(error) },
				pairedItem: { item: itemIndex },
			});
		}
	}

	return [returnData];
}
