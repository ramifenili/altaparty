'use client';

import React, {useState} from 'react';

/** Cinta descartable entre el menú y el hero. */
export function Banner({children}: {children: React.ReactNode}) {
	const [open, setOpen] = useState(true);
	if (!open) return null;
	return (
		<div className="lf-banner" role="note">
			<span aria-hidden="true">🚀</span>
			<p>{children}</p>
			<button type="button" onClick={() => setOpen(false)} aria-label="Cerrar aviso">×</button>
		</div>
	);
}
