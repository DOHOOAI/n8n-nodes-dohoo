import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DohooApi implements ICredentialType {
	name = 'dohooApi';

	displayName = 'DOHOO API';

	icon = {
		light: 'file:../nodes/dohoo.svg',
		dark: 'file:../nodes/dohoo.dark.svg',
	} as const;

	documentationUrl = 'https://dohoo.ai/settings/api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key from the API section of your DOHOO account settings',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://dohoo.ai',
			url: '/api/auth/me',
			method: 'GET',
		},
	};
}
