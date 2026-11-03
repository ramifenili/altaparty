'use client';

import React, {useState} from 'react';
import {Rocket} from 'lucide-react';

/** Cinta descartable entre el menú y el hero. */
export function Banner({children}: {children: React.ReactNode}) {
	const [open, setOpen] = useState(true);
	if (!open) return null;
	return (
		<div className="lf-banner" role="note">
			<Rocket size={18} aria-hidden="true" />
			<p>{children}</p>
			<button type="button" onClick={() => setOpen(false)} aria-label="Cerrar aviso">×</button>
		</div>
	);
}
