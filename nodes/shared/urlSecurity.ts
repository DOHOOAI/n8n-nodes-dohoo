const nonPublicIpv4Ranges = [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4],
] as const;

const nonPublicIpv6Ranges = [
	['::', 128],
	['::1', 128],
	['::ffff:0:0', 96],
	['64:ff9b:1::', 48],
	['100::', 64],
	['2001:db8::', 32],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8],
] as const;

const awsRegionPattern =
	'(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|northeast|northwest|south|southeast|southwest|west)-[0-9]';
const dohooRegionalS3Pattern = new RegExp(
	`^dohoo-upload-temp\\.s3[.-]${awsRegionPattern}\\.amazonaws\\.com$`,
);
const dohooDualstackS3Pattern = new RegExp(
	`^dohoo-upload-temp\\.s3\\.dualstack\\.${awsRegionPattern}\\.amazonaws\\.com$`,
);

export interface UrlValidationResult {
	url?: URL;
	error?: string;
}

function normalizedHostname(hostname: string): string {
	return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

export function isNonPublicNetworkAddress(address: string): boolean {
	const normalized = normalizedHostname(address);
	const ipv4 = parseIpv4(normalized);
	if (ipv4 !== undefined) {
		return nonPublicIpv4Ranges.some(([network, prefix]) =>
			isIpv4InRange(ipv4, parseIpv4(network) ?? 0, prefix),
		);
	}
	const ipv6 = parseIpv6(normalized);
	if (ipv6) {
		return nonPublicIpv6Ranges.some(([network, prefix]) => {
			const parsedNetwork = parseIpv6(network);
			return parsedNetwork ? isIpv6InRange(ipv6, parsedNetwork, prefix) : true;
		});
	}
	return true;
}

function parseIpv4(address: string): number | undefined {
	const parts = address.split('.');
	if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return undefined;
	const octets = parts.map(Number);
	if (octets.some((octet) => octet < 0 || octet > 255)) return undefined;
	return octets.reduce((result, octet) => result * 256 + octet, 0) >>> 0;
}

function isIpv4InRange(address: number, network: number, prefix: number): boolean {
	const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
	return ((address & mask) >>> 0) === ((network & mask) >>> 0);
}

function parseIpv6(address: string): number[] | undefined {
	let normalized = address.toLowerCase();
	if (normalized.includes('.')) {
		const lastColon = normalized.lastIndexOf(':');
		const ipv4 = parseIpv4(normalized.slice(lastColon + 1));
		if (lastColon < 0 || ipv4 === undefined) return undefined;
		normalized = `${normalized.slice(0, lastColon)}:${((ipv4 >>> 16) & 0xffff).toString(16)}:${(
			ipv4 & 0xffff
		).toString(16)}`;
	}
	if ((normalized.match(/::/g) ?? []).length > 1) return undefined;
	const compressed = normalized.includes('::');
	const [left = '', right = ''] = normalized.split('::');
	const leftParts = left ? left.split(':') : [];
	const rightParts = compressed && right ? right.split(':') : [];
	const explicitParts = compressed ? [...leftParts, ...rightParts] : leftParts;
	if ((!compressed && explicitParts.length !== 8) || (compressed && explicitParts.length >= 8)) {
		return undefined;
	}
	if (explicitParts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return undefined;
	const zeroCount = compressed ? 8 - explicitParts.length : 0;
	return [
		...leftParts.map((part) => Number.parseInt(part, 16)),
		...Array.from({ length: zeroCount }, () => 0),
		...rightParts.map((part) => Number.parseInt(part, 16)),
	];
}

function isIpv6InRange(address: number[], network: number[], prefix: number): boolean {
	const completeParts = Math.floor(prefix / 16);
	for (let index = 0; index < completeParts; index++) {
		if (address[index] !== network[index]) return false;
	}
	const remainingBits = prefix % 16;
	if (!remainingBits) return true;
	const mask = (0xffff << (16 - remainingBits)) & 0xffff;
	return (address[completeParts] & mask) === (network[completeParts] & mask);
}

export function isBlockedExternalHostname(hostname: string): boolean {
	const normalized = normalizedHostname(hostname);
	if (!normalized || parseIpv4(normalized) !== undefined || parseIpv6(normalized)) return false;
	if (!normalized.includes('.')) return true;
	return [
		'localhost',
		'.localhost',
		'.local',
		'.internal',
		'.localdomain',
		'.lan',
		'.home.arpa',
		'.test',
		'.invalid',
	].some((suffix) => normalized === suffix.replace(/^\./, '') || normalized.endsWith(suffix));
}

function parseHttpsUrl(value: string): UrlValidationResult {
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		return { error: 'Enter a valid HTTPS URL' };
	}
	if (parsed.protocol !== 'https:') return { error: 'The URL must use HTTPS' };
	if (parsed.username || parsed.password) {
		return { error: 'URLs containing credentials are not allowed' };
	}
	return { url: parsed };
}

export function validatePublicExternalUrl(value: string): UrlValidationResult {
	const validation = parseHttpsUrl(value);
	if (!validation.url) return validation;
	const parsed = validation.url;
	const hostname = normalizedHostname(parsed.hostname);
	if (isBlockedExternalHostname(hostname)) {
		return { error: 'External URLs cannot use local or internal hostnames' };
	}
	if ((parseIpv4(hostname) !== undefined || parseIpv6(hostname)) && isNonPublicNetworkAddress(hostname)) {
		return { error: 'External URLs cannot use private, local, or reserved IP addresses' };
	}
	return { url: parsed };
}

export function validateDohooUploadUrl(value: string): UrlValidationResult {
	const validation = parseHttpsUrl(value);
	if (!validation.url) return validation;
	const parsed = validation.url;
	const hostname = normalizedHostname(parsed.hostname);
	const isStandardEndpoint =
		hostname === 'dohoo-upload-temp.s3.amazonaws.com' ||
		hostname === 'dohoo-upload-temp.s3-accelerate.amazonaws.com' ||
		dohooRegionalS3Pattern.test(hostname);
	const isDualstackEndpoint =
		dohooDualstackS3Pattern.test(hostname) ||
		hostname === 'dohoo-upload-temp.s3-accelerate.dualstack.amazonaws.com';
	if (!isStandardEndpoint && !isDualstackEndpoint) {
		return { error: 'DOHOO returned an upload URL outside its approved AWS S3 bucket' };
	}
	return { url: parsed };
}
