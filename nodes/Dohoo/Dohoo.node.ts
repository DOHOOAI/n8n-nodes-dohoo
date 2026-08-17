import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { PLATFORM_CODES } from '../shared/constants';
import {
	createConnectionLoader,
	createConnectionSearch,
	getPinterestBoards,
	searchPinterestBoards,
} from '../shared/loadOptions';
import { applyOutputMode, outputProperties } from '../shared/output';
import { FacebookResource } from '../shared/resources/Facebook';
import { InstagramResource } from '../shared/resources/Instagram';
import { LinkedInResource } from '../shared/resources/LinkedIn';
import { MediaResource } from '../shared/resources/Media';
import { PinterestResource } from '../shared/resources/Pinterest';
import { ScheduledPostsResource } from '../shared/resources/ScheduledPosts';
import { ThreadsResource } from '../shared/resources/Threads';
import { TikTokResource } from '../shared/resources/TikTok';
import { TranscriptionResource } from '../shared/resources/Transcription';
import { XResource } from '../shared/resources/X';
import { YouTubeResource } from '../shared/resources/YouTube';

const resourceNodes = {
	instagram: new InstagramResource(),
	facebook: new FacebookResource(),
	tiktok: new TikTokResource(),
	youtube: new YouTubeResource(),
	x: new XResource(),
	linkedin: new LinkedInResource(),
	pinterest: new PinterestResource(),
	threads: new ThreadsResource(),
	media: new MediaResource(),
	scheduledPosts: new ScheduledPostsResource(),
	transcription: new TranscriptionResource(),
};

type DohooResource = keyof typeof resourceNodes;

const resourceOptions: Array<{
	name: string;
	value: DohooResource;
}> = [
	{ name: 'Facebook', value: 'facebook' },
	{ name: 'Instagram', value: 'instagram' },
	{ name: 'LinkedIn', value: 'linkedin' },
	{ name: 'Media', value: 'media' },
	{ name: 'Pinterest', value: 'pinterest' },
	{ name: 'Scheduled Posts', value: 'scheduledPosts' },
	{ name: 'Threads', value: 'threads' },
	{ name: 'TikTok', value: 'tiktok' },
	{ name: 'Transcription', value: 'transcription' },
	{ name: 'X', value: 'x' },
	{ name: 'YouTube', value: 'youtube' },
];

const platformsByResource: Partial<Record<DohooResource, readonly string[]>> = {
	instagram: PLATFORM_CODES.instagram,
	facebook: PLATFORM_CODES.facebook,
	tiktok: PLATFORM_CODES.tiktok,
	youtube: PLATFORM_CODES.youtube,
	x: PLATFORM_CODES.twitter,
	linkedin: PLATFORM_CODES.linkedin,
	pinterest: PLATFORM_CODES.pinterest,
	threads: PLATFORM_CODES.threads,
};

function isDohooResource(value: string): value is DohooResource {
	return Object.prototype.hasOwnProperty.call(resourceNodes, value);
}

function scopeProperties(resource: DohooResource): INodeProperties[] {
	return resourceNodes[resource].definition.properties.map((property) => ({
		...property,
		displayOptions: {
			...property.displayOptions,
			show: {
				...property.displayOptions?.show,
				resource: [resource],
			},
		},
	}));
}

export class Dohoo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DOHOO',
		name: 'dohoo',
		icon: { light: 'file:../dohoo.svg', dark: 'file:../dohoo.dark.svg' },
		group: ['input', 'output', 'transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Publish, schedule, manage media, and transcribe content through DOHOO',
		defaults: { name: 'DOHOO' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'dohooApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: resourceOptions,
				default: 'instagram',
			},
			...scopeProperties('facebook'),
			...scopeProperties('instagram'),
			...scopeProperties('linkedin'),
			...scopeProperties('media'),
			...scopeProperties('pinterest'),
			...scopeProperties('scheduledPosts'),
			...scopeProperties('threads'),
			...scopeProperties('tiktok'),
			...scopeProperties('transcription'),
			...scopeProperties('x'),
			...scopeProperties('youtube'),
			...outputProperties,
		],
	};

	methods = {
		loadOptions: {
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const resource = String(this.getNodeParameter('resource', ''));
				if (!isDohooResource(resource)) return [];
				const platforms = platformsByResource[resource];
				if (!platforms) return [];
				return await createConnectionLoader(platforms).call(this);
			},
			async getBoards(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await getPinterestBoards.call(this);
			},
		},
		listSearch: {
			async searchConnections(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const resource = String(this.getNodeParameter('resource', ''));
				if (!isDohooResource(resource)) return { results: [] };
				const platforms = platformsByResource[resource];
				if (!platforms) return { results: [] };
				return await createConnectionSearch(platforms).call(this, filter);
			},
			async searchBoards(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				return await searchPinterestBoards.call(this, filter);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const resource = String(this.getNodeParameter('resource', 0));
		if (!isDohooResource(resource)) {
			throw new NodeOperationError(this.getNode(), `Unsupported DOHOO resource: ${resource}`);
		}
		return applyOutputMode(this, await resourceNodes[resource].run.call(this));
	}
}
