export function locatorValue(value: unknown): string {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const candidate = (value as Record<string, unknown>).value;
		return candidate === undefined || candidate === null ? '' : String(candidate);
	}
	return value === undefined || value === null ? '' : String(value);
}
