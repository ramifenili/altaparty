import type {MetadataRoute} from 'next';
import {siteUrl} from '../src/server/seo';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [{userAgent: '*', allow: ['/', '/invitacion/'], disallow: ['/admin', '/api/']}],
		sitemap: `${siteUrl()}/sitemap.xml`,
	};
}
