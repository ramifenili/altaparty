import React from 'react';

/** Personajes geométricos con cara (SVG propio, sin imágenes externas). */
export type MascotKind = 'star' | 'circle' | 'triangle' | 'square' | 'blob';

const INK = '#1b1b1f';

function Face({x, y, s = 1}: {x: number; y: number; s?: number}) {
	return (
		<g transform={`translate(${x} ${y}) scale(${s})`} fill={INK}>
			<circle cx="-14" cy="0" r="4.5" />
			<circle cx="14" cy="0" r="4.5" />
			<path d="M-9 11 Q0 21 9 11" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
		</g>
	);
}

export function Mascot({kind, className, label}: {kind: MascotKind; className?: string; label?: string}) {
	const a11y = label ? {role: 'img', 'aria-label': label} : {'aria-hidden': true as const};
	return (
		<svg viewBox="0 0 160 190" className={className} {...a11y}>
			{/* patitas */}
			<path d="M62 150 V182 M98 150 V182" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
			{kind === 'star' && (
				<>
					<path d="M80 6 L98 52 L148 56 L110 88 L122 136 L80 110 L38 136 L50 88 L12 56 L62 52 Z" fill="#f6be1d" stroke="#f6be1d" strokeWidth="12" strokeLinejoin="round" />
					<Face x={80} y={80} />
				</>
			)}
			{kind === 'circle' && (
				<>
					<circle cx="80" cy="88" r="62" fill="#0f978f" />
					<Face x={80} y={86} />
				</>
			)}
			{kind === 'triangle' && (
				<>
					<path d="M80 22 L144 140 H16 Z" fill="#8b51ac" stroke="#8b51ac" strokeWidth="14" strokeLinejoin="round" />
					<Face x={80} y={102} s={0.9} />
				</>
			)}
			{kind === 'square' && (
				<>
					<rect x="22" y="30" width="116" height="116" rx="26" fill="#fff" stroke="#bcc9cb" strokeWidth="3" />
					<Face x={80} y={84} />
				</>
			)}
			{kind === 'blob' && (
				<>
					<path d="M40 40 C70 10 130 20 142 70 C152 118 112 150 70 144 C24 138 8 70 40 40 Z" fill="#bcc9cb" />
					<Face x={78} y={86} />
				</>
			)}
		</svg>
	);
}
