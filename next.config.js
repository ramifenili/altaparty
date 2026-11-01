/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

// FFmpeg.wasm corre en un Web Worker con el núcleo de UN solo hilo
// (public/ffmpeg), por lo que NO necesita COOP/COEP ni SharedArrayBuffer.
// Sí requiere permitir WebAssembly ('wasm-unsafe-eval') y workers/blobs propios.
const csp = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https:",
	"media-src 'self' blob:",
	"font-src 'self' data:",
	"connect-src 'self' blob: data: https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.clarity.ms https://c.bing.com",
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
].join('; ');

const nextConfig = {
	poweredByHeader: false,
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{key: 'X-Content-Type-Options', value: 'nosniff'},
					{key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
					{key: 'X-Frame-Options', value: 'DENY'},
					{key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
					...(isProd ? [{key: 'Content-Security-Policy', value: csp}] : []),
				],
			},
			{
				// los binarios de FFmpeg y las pistas de audio no cambian: se pueden cachear
				source: '/ffmpeg/:file*',
				headers: [{key: 'Cache-Control', value: 'public, max-age=31536000, immutable'}],
			},
			{
				source: '/audio/:file*',
				headers: [{key: 'Cache-Control', value: 'public, max-age=86400'}],
			},
		];
	},
};

module.exports = nextConfig;
