export type ServedMedia = {status: number; headers: Record<string, string>; body: BodyInit | null};

export const MEDIA_HEADERS = {
	'Accept-Ranges': 'bytes',
	'Cache-Control': 'public, max-age=3600',
	'X-Content-Type-Options': 'nosniff',
};
