import type { IDataObject, IExecuteFunctions, IN8nHttpFullResponse } from 'n8n-workflow';
import { NodeOperationError, sleep } from 'n8n-workflow';

import { DOHOO_MEDIA_PREFIX, DOHOO_UPLOAD_REDIRECT_PREFIX, MAX_UPLOAD_BYTES } from './constants';
import { asDataObject, dohooApiRequest } from './transport';
import { validateDohooUploadUrl, validatePublicExternalUrl } from './urlSecurity';

interface UploadInput {
	fileName: string;
	mimeType: string;
	fileSize: number;
	body: unknown;
}

export interface ResolvedMedia {
	fileUrl: string;
	fileId?: number;
	videoId?: string;
	uploaded: boolean;
}

function parseByteCount(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value !== 'string') return undefined;
	const numeric = Number(value.replace(/[^0-9.]/g, ''));
	if (!Number.isFinite(numeric)) return undefined;
	if (/gb/i.test(value)) return Math.round(numeric * 1024 * 1024 * 1024);
	if (/mb/i.test(value)) return Math.round(numeric * 1024 * 1024);
	if (/kb/i.test(value)) return Math.round(numeric * 1024);
	return Math.round(numeric);
}

function validateSize(context: IExecuteFunctions, itemIndex: number, fileSize: number): void {
	if (fileSize <= 0) {
		throw new NodeOperationError(context.getNode(), 'The media file is empty', {
			itemIndex,
			description: 'Choose a non-empty binary file or a different media source, then run the node again.',
		});
	}
	if (fileSize > MAX_UPLOAD_BYTES) {
		throw new NodeOperationError(context.getNode(), 'The media file exceeds the 2 GB limit', {
			itemIndex,
			description: 'Use a file smaller than 2 GB, then run the node again.',
		});
	}
}

function assertHttps(context: IExecuteFunctions, itemIndex: number, value: string): URL {
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new NodeOperationError(context.getNode(), 'Enter a valid HTTPS media URL', {
			itemIndex,
			description: 'Enter the complete public URL beginning with https://, then run the node again.',
		});
	}
	if (parsed.protocol !== 'https:') {
		throw new NodeOperationError(context.getNode(), 'Media URLs must use HTTPS', {
			itemIndex,
			description: 'Replace the URL with its HTTPS version, then run the node again.',
		});
	}
	return parsed;
}

function mimeTypeFromName(fileName: string): string {
	const extension = fileName.split('.').pop()?.toLowerCase();
	const types: Record<string, string> = {
		gif: 'image/gif',
		jpeg: 'image/jpeg',
		jpg: 'image/jpeg',
		m4v: 'video/x-m4v',
		mov: 'video/quicktime',
		mp4: 'video/mp4',
		png: 'image/png',
		webm: 'video/webm',
		webp: 'image/webp',
	};
	return extension ? (types[extension] ?? 'application/octet-stream') : 'application/octet-stream';
}

function fileNameFromUrl(url: URL): string {
	const candidate = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? 'media');
	return candidate || 'media';
}

async function binaryUploadInput(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<UploadInput> {
	const propertyName = String(context.getNodeParameter('binaryPropertyName', itemIndex, 'data'));
	const binary = context.helpers.assertBinaryData(itemIndex, propertyName);
	let fileName = binary.fileName ?? `media.${binary.fileExtension ?? 'bin'}`;
	let mimeType = binary.mimeType || mimeTypeFromName(fileName);
	let fileSize = binary.bytes ?? parseByteCount(binary.fileSize);
	let body: unknown;

	if (binary.id) {
		const metadata = await context.helpers.getBinaryMetadata(binary.id);
		fileName = metadata.fileName ?? fileName;
		mimeType = metadata.mimeType ?? mimeType;
		fileSize = metadata.fileSize;
		validateSize(context, itemIndex, fileSize);
		body = await context.helpers.getBinaryStream(binary.id);
	} else {
		if (fileSize !== undefined) validateSize(context, itemIndex, fileSize);
		const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, propertyName);
		fileSize = buffer.length;
		validateSize(context, itemIndex, fileSize);
		body = buffer;
	}

	return { fileName, mimeType, fileSize, body };
}

async function externalUploadInput(
	context: IExecuteFunctions,
	itemIndex: number,
	url: string,
): Promise<UploadInput> {
	let validation = validatePublicExternalUrl(url);
	if (!validation.url) {
		throw new NodeOperationError(
			context.getNode(),
			validation.error ?? 'The External URL is not allowed',
			{
				itemIndex,
				description:
					'Use a public HTTPS URL that does not resolve to a local, private, loopback, or cloud-metadata address.',
			},
		);
	}
	let parsed = validation.url;

	let response: IN8nHttpFullResponse | undefined;
	for (let redirectCount = 0; redirectCount <= 5; redirectCount++) {
		response = (await context.helpers.httpRequest({
			url: parsed.toString(),
			method: 'GET',
			encoding: 'stream',
			returnFullResponse: true,
			disableFollowRedirect: true,
			ignoreHttpStatusErrors: true,
			timeout: 120_000,
		})) as IN8nHttpFullResponse;
		if (response.statusCode < 300 || response.statusCode >= 400) break;

		const body = response.body as { destroy?: () => void } | undefined;
		body?.destroy?.();
		const location = response.headers.location;
		if (typeof location !== 'string') {
			throw new NodeOperationError(
				context.getNode(),
				'The External URL redirect did not include a destination',
				{
					itemIndex,
					description: 'Enter the final public HTTPS file URL directly, then run the node again.',
				},
			);
		}
		if (redirectCount === 5) {
			throw new NodeOperationError(context.getNode(), 'The External URL redirected too many times', {
				itemIndex,
				description: 'Enter the final public HTTPS file URL directly instead of a redirecting URL.',
			});
		}
		validation = validatePublicExternalUrl(new URL(location, parsed).toString());
		if (!validation.url) {
			throw new NodeOperationError(
				context.getNode(),
				validation.error ?? 'The External URL redirect is not allowed',
				{
					itemIndex,
					description:
						'Use a redirect whose destination is a public HTTPS URL and not a local, private, loopback, or cloud-metadata address.',
				},
			);
		}
		parsed = validation.url;
	}
	if (!response || response.statusCode < 200 || response.statusCode >= 300) {
		const body = response?.body as { destroy?: () => void } | undefined;
		body?.destroy?.();
		throw new NodeOperationError(
			context.getNode(),
			`The External URL returned HTTP ${response?.statusCode ?? 'unknown'}`,
			{
				itemIndex,
				description: 'Make the file publicly downloadable over HTTPS or use n8n binary data instead.',
			},
		);
	}
	const headerLength = response.headers['content-length'];
	const fileSize = parseByteCount(headerLength);
	if (fileSize === undefined) {
		const body = response.body as { destroy?: () => void } | undefined;
		body?.destroy?.();
		throw new NodeOperationError(
			context.getNode(),
			'The external server did not provide Content-Length; download the file into n8n binary data first',
			{
				itemIndex,
				description:
					'Download the file with an HTTP Request node, enable binary output, and select that binary property as the media source.',
			},
		);
	}
	validateSize(context, itemIndex, fileSize);
	const fileName = fileNameFromUrl(parsed);
	const headerType = response.headers['content-type'];
	const mimeType =
		typeof headerType === 'string' ? headerType.split(';')[0] : mimeTypeFromName(fileName);
	return { fileName, mimeType, fileSize, body: response.body };
}

function completedFileUrl(payload: unknown): string | undefined {
	const object = asDataObject(payload);
	const file = asDataObject(object.file);
	const candidates = [
		file.canonicalUrl,
		file.mediaUrl,
		file.fileUrl,
		file.url,
		file.directHttpsUrl,
		file.directFileUrl,
		object.canonicalUrl,
		object.mediaUrl,
		object.fileUrl,
		object.url,
	];
	return candidates.find(
		(candidate): candidate is string =>
			typeof candidate === 'string' &&
			(candidate.startsWith(DOHOO_MEDIA_PREFIX) ||
				candidate.startsWith(DOHOO_UPLOAD_REDIRECT_PREFIX)),
	);
}

export async function normalizeFileForOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	payload: unknown,
): Promise<IDataObject> {
	const object = asDataObject(payload);
	const nestedFile = asDataObject(object.file);
	const file = Object.keys(nestedFile).length ? nestedFile : object;
	const output: IDataObject = { ...file };
	const numericId = Number(file.fileId ?? file.id);
	if (Number.isInteger(numericId) && numericId > 0) {
		output.id = file.id ?? numericId;
		output.fileId = numericId;
	}

	const status = String(file.status ?? object.status ?? '').toLowerCase();
	const canResolve = !status || ['completed', 'ready', 'uploaded'].includes(status);
	const candidates = [
		file.fileUrl,
		file.url,
		file.directFileUrl,
		file.directHttpsUrl,
		file.directUrl,
	];
	const canonical = candidates.find(
		(candidate): candidate is string =>
			typeof candidate === 'string' && candidate.startsWith(DOHOO_MEDIA_PREFIX),
	);
	const redirect = candidates.find(
		(candidate): candidate is string =>
			typeof candidate === 'string' && candidate.startsWith(DOHOO_UPLOAD_REDIRECT_PREFIX),
	);
	let fileUrl = canonical;
	if (!fileUrl && redirect && canResolve) {
		fileUrl = await resolveDohooMediaUrl(context, itemIndex, redirect);
	}

	delete output.directHttpsUrl;
	delete output.directUrl;
	delete output.downloadUrl;
	delete output.url;
	delete output.fileUrl;
	delete output.directFileUrl;
	if (fileUrl) {
		output.fileUrl = fileUrl;
		output.url = fileUrl;
		output.directFileUrl = fileUrl;
	}
	if (redirect) output.redirectUrl = redirect;
	output.readyForPublish = Boolean(fileUrl) && status !== 'processing' && status !== 'uploading';
	return output;
}

export async function resolveDohooMediaUrl(
	context: IExecuteFunctions,
	itemIndex: number,
	url: string,
): Promise<string> {
	assertHttps(context, itemIndex, url);
	let canonicalUrl = url;
	if (!url.startsWith(DOHOO_MEDIA_PREFIX) && !url.startsWith(DOHOO_UPLOAD_REDIRECT_PREFIX)) {
		throw new NodeOperationError(
			context.getNode(),
			`DOHOO media URLs must start with ${DOHOO_MEDIA_PREFIX}`,
			{
				itemIndex,
				description: 'Use the canonical DOHOO media-storage URL or select DOHOO File ID as the media source.',
			},
		);
	}

	for (const waitMs of [0, 250, 500, 1_000, 2_000, 4_000, 6_000]) {
		if (waitMs) await sleep(waitMs);
		if (canonicalUrl.startsWith(DOHOO_UPLOAD_REDIRECT_PREFIX)) {
			const redirect = (await context.helpers.httpRequest({
				url: canonicalUrl,
				method: 'HEAD',
				disableFollowRedirect: true,
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
				timeout: 10_000,
			})) as IN8nHttpFullResponse;
			const location = redirect.headers.location;
			if (typeof location !== 'string' || !location.startsWith(DOHOO_MEDIA_PREFIX)) continue;
			canonicalUrl = location;
		}

		let response = (await context.helpers.httpRequest({
			url: canonicalUrl,
			method: 'HEAD',
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
			timeout: 10_000,
		})) as IN8nHttpFullResponse;
		if (response.statusCode === 405 || response.statusCode === 501) {
			response = (await context.helpers.httpRequest({
				url: canonicalUrl,
				method: 'GET',
				headers: { Range: 'bytes=0-0' },
				encoding: 'arraybuffer',
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
				timeout: 10_000,
			})) as IN8nHttpFullResponse;
		}
		if ((response.statusCode >= 200 && response.statusCode < 300) || response.statusCode === 206) {
			return canonicalUrl;
		}
	}
	throw new NodeOperationError(
		context.getNode(),
		'DOHOO media storage has not made this file publicly available yet; retry shortly without uploading it again',
		{
			itemIndex,
			description: 'Wait briefly and retry using the same DOHOO File ID. Do not upload the file bytes again.',
		},
	);
}

async function waitForCompletedFile(
	context: IExecuteFunctions,
	itemIndex: number,
	fileId: number,
): Promise<string> {
	let publicResolutionAttempts = 0;
	for (let attempt = 0; attempt < 40; attempt++) {
		const payload = asDataObject(
			await dohooApiRequest(context, 'GET', `/api/upload/status/${fileId}`),
		);
		const file = asDataObject(payload.file);
		const status = String(payload.status ?? file.status ?? '').toLowerCase();
		if (status === 'failed') {
			throw new NodeOperationError(
				context.getNode(),
				String(payload.error ?? file.error ?? 'DOHOO could not process the uploaded file'),
				{
					itemIndex,
					description: 'Inspect the file in DOHOO and upload a valid supported media file before retrying.',
				},
			);
		}
		if (['completed', 'ready', 'uploaded'].includes(status)) {
			const direct = asDataObject(
				await dohooApiRequest(context, 'GET', `/api/upload/direct/${fileId}`),
			);
			const found = completedFileUrl(direct) ?? completedFileUrl(payload);
			if (found) {
				try {
					return await resolveDohooMediaUrl(context, itemIndex, found);
				} catch (error) {
					publicResolutionAttempts += 1;
					if (publicResolutionAttempts >= 3) {
						throw new NodeOperationError(
							context.getNode(),
							error instanceof Error ? error.message : 'The public media URL is not ready',
							{
								itemIndex,
								description: 'Wait briefly and retry using the same DOHOO File ID. Do not upload the file bytes again.',
							},
						);
					}
				}
			}
		}
		await sleep(1_500);
	}
	throw new NodeOperationError(
		context.getNode(),
		'Timed out waiting for DOHOO to process the file',
		{
			itemIndex,
			description: 'Wait briefly and retry using the same DOHOO File ID. Do not upload the file bytes again.',
		},
	);
}

export async function resolveFileIdMediaUrl(
	context: IExecuteFunctions,
	itemIndex: number,
	fileId: number,
): Promise<string> {
	return await waitForCompletedFile(context, itemIndex, fileId);
}

async function uploadToDohoo(
	context: IExecuteFunctions,
	itemIndex: number,
	input: UploadInput,
): Promise<ResolvedMedia> {
	const slot = asDataObject(
		await dohooApiRequest(context, 'POST', '/api/upload/presigned-url', {
			filename: input.fileName,
			contentType: input.mimeType,
		}),
	);
	const uploadUrl = String(slot.uploadUrl ?? '');
	const fileId = Number(slot.fileId);
	if (!uploadUrl || !Number.isInteger(fileId) || fileId <= 0) {
		throw new NodeOperationError(context.getNode(), 'DOHOO returned an invalid upload slot', {
			itemIndex,
			description: 'Run the node again. If the error persists, verify the DOHOO subscription and contact DOHOO support.',
		});
	}
	const uploadValidation = validateDohooUploadUrl(uploadUrl);
	if (!uploadValidation.url) {
		throw new NodeOperationError(
			context.getNode(),
			uploadValidation.error ?? 'DOHOO returned an invalid upload URL',
			{
				itemIndex,
				description: 'Run the node again to request a new upload URL. If it persists, contact DOHOO support.',
			},
		);
	}
	const approvedUploadUrl = uploadValidation.url;

	await context.helpers.httpRequest({
		url: approvedUploadUrl.toString(),
		method: 'PUT',
		headers: {
			'Content-Length': input.fileSize,
			'Content-Type': input.mimeType,
		},
		body: input.body as Buffer,
		json: false,
		timeout: 3_600_000,
	});

	try {
		return {
			fileUrl: await waitForCompletedFile(context, itemIndex, fileId),
			fileId,
			videoId: typeof slot.videoId === 'string' ? slot.videoId : undefined,
			uploaded: true,
		};
	} catch (error) {
		throw new NodeOperationError(
			context.getNode(),
			`The bytes were uploaded as DOHOO file ID ${fileId}, but the public media URL is not ready. Retry with Media Source “DOHOO File ID” and File ID ${fileId}; do not upload the bytes again. ${error instanceof Error ? error.message : ''}`.trim(),
			{
				itemIndex,
				description: `Select DOHOO File ID as the media source, enter ${fileId}, and retry later without uploading the bytes again.`,
			},
		);
	}
}

export async function resolveMedia(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<ResolvedMedia | undefined> {
	const source = String(context.getNodeParameter('mediaSource', itemIndex, 'none'));
	if (source === 'none') return undefined;
	if (source === 'dohooUrl') {
		return {
			fileUrl: await resolveDohooMediaUrl(
				context,
				itemIndex,
				String(context.getNodeParameter('mediaUrl', itemIndex)),
			),
			uploaded: false,
		};
	}
	if (source === 'fileId') {
		const fileId = Number(context.getNodeParameter('fileId', itemIndex));
		return {
			fileUrl: await resolveFileIdMediaUrl(context, itemIndex, fileId),
			fileId,
			uploaded: false,
		};
	}
	if (source === 'binary') {
		return uploadToDohoo(context, itemIndex, await binaryUploadInput(context, itemIndex));
	}
	if (source === 'externalUrl') {
		const url = String(context.getNodeParameter('externalUrl', itemIndex));
		return uploadToDohoo(context, itemIndex, await externalUploadInput(context, itemIndex, url));
	}
	throw new NodeOperationError(context.getNode(), `Unsupported media source: ${source}`, {
		itemIndex,
		description: 'Select one of the available Media Source options and run the node again.',
	});
}

export async function resolveMediaUrl(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<string | undefined> {
	return (await resolveMedia(context, itemIndex))?.fileUrl;
}
