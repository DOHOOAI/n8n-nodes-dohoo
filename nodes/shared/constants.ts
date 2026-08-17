export const DOHOO_BASE_URL = 'https://dohoo.ai';

export const DOHOO_MEDIA_PREFIX = 'https://mediastorage.dohoo.ai/file/dohoo-video-storage/';

export const DOHOO_UPLOAD_REDIRECT_PREFIX = 'https://dohoo.ai/api/upload/file/';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export const TEXT_LIMITS = {
	facebookCaption: 63_206,
	instagramCaption: 2_200,
	tiktokVideoDescription: 2_200,
	tiktokCarouselDescription: 4_000,
	youtubeTitle: 100,
	youtubeDescription: 5_000,
	xText: 280,
	linkedinText: 3_000,
	pinterestTitle: 100,
	pinterestDescription: 800,
	threadsText: 500,
} as const;

export const PLATFORM_CODES = {
	facebook: ['facebook', 'facebook_page'],
	instagram: ['instagram', 'instagram_business'],
	linkedin: ['linkedin'],
	pinterest: ['pinterest'],
	threads: ['threads'],
	tiktok: ['tiktok'],
	twitter: ['twitter', 'x'],
	youtube: ['youtube'],
} as const;
