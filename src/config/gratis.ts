// Programa "Video gratis a cambio de difusión". Reglas compartidas por el
// cliente (se muestran) y el servidor (se validan). Sin imports.
//
// Por qué funciona: el video se renderiza en el navegador, así que regalarlo no
// cuesta casi nada; lo que se pierde es una venta. Por eso el canje exige un
// posteo PÚBLICO de la vista previa (que lleva nuestra marca de agua = publicidad)
// con un mínimo de vistas, y lo revisa una persona.

export type NetworkId = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x';

export type Network = {
	id: NetworkId;
	name: string;
	icon: string;
	/** qué tipo de publicación sirve */
	format: string;
	/** vistas mínimas de UNA publicación para obtener el video gratis */
	threshold: number;
	hosts: string[];
	note?: string;
};

export const GRATIS = {
	/** usuario de la marca en las redes (para que etiqueten) */
	handle: 'invitaenvideo',
	hashtag: '#InvitaEnVideo',
	/** días que la publicación debe seguir pública */
	keepPublicDays: 30,
	/** una persona (email / WhatsApp) puede canjear una vez cada tantos días */
	perContactDays: 30,
	/** horas en que se revisa cada canje */
	reviewHours: 24,
} as const;

export const NETWORKS: Network[] = [
	{id: 'instagram', name: 'Instagram', icon: 'camera', format: 'Reel o publicación pública', threshold: 500, hosts: ['instagram.com']},
	{id: 'tiktok', name: 'TikTok', icon: 'music', format: 'Video público', threshold: 500, hosts: ['tiktok.com']},
	{id: 'facebook', name: 'Facebook', icon: 'thumbs-up', format: 'Reel o video público', threshold: 500, hosts: ['facebook.com', 'fb.watch', 'fb.com']},
	{id: 'youtube', name: 'YouTube Shorts', icon: 'play', format: 'Short público', threshold: 500, hosts: ['youtube.com', 'youtu.be']},
	{
		id: 'x',
		name: 'X',
		icon: 'x',
		format: 'Posteo público con el video',
		threshold: 5000,
		hosts: ['x.com', 'twitter.com'],
		note: 'En X cuentan impresiones, por eso el mínimo es 10 veces mayor.',
	},
];

export const getNetwork = (id: unknown) => NETWORKS.find((n) => n.id === id);

const TRACKING = /^(utm_.*|igsh|igshid|si|fbclid|feature|t|s|ref|ref_src|mibextid)$/i;

/**
 * Devuelve el enlace normalizado (https, sin parámetros de seguimiento) o null si no es un
 * enlace de esa red. Sirve para detectar el mismo posteo enviado dos veces.
 */
export function parsePostUrl(raw: unknown, networkId: NetworkId): string | null {
	const net = getNetwork(networkId);
	if (!net || typeof raw !== 'string' || raw.length > 400) return null;
	let u: URL;
	try {
		u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
	} catch {
		return null;
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
	const host = u.hostname.toLowerCase();
	if (!net.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return null;
	// tiene que apuntar a una publicación concreta, no al perfil/portada
	if (u.pathname.replace(/\/+$/, '').length < 3 && !u.searchParams.has('v')) return null;
	for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
	u.searchParams.sort();
	const path = u.pathname.replace(/\/+$/, '');
	const q = u.searchParams.toString();
	return `https://${host.replace(/^(www|m)\./, '')}${path}${q ? `?${q}` : ''}`;
}

/** Email en minúsculas o WhatsApp solo con dígitos (`wa:5491112345678`); null si no sirve. */
export function normalizeContact(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const v = raw.trim();
	if (v.length > 120) return null;
	if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v.toLowerCase() : null;
	const digits = v.replace(/\D/g, '');
	return digits.length >= 8 && digits.length <= 15 ? `wa:${digits}` : null;
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

/** Estado que ve quien hizo el canje. */
export type ClaimView = {
	claimId: string;
	status: ClaimStatus;
	network: NetworkId;
	templateId: string;
	createdAt: number;
	/** solo si está aprobado: el código para usar en "Ya compré" */
	purchaseId?: string;
	/** motivo, si se rechazó */
	note?: string;
};
