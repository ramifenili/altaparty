'use client';

import {useEffect, useState} from 'react';
import {getConsent, hasAnalyticsConfigured, setConsent, subscribeConsent} from '../lib/analytics';

/** Aviso de analítica: Google Analytics y Clarity solo se cargan si la persona acepta. */
export function ConsentBanner() {
	const [show, setShow] = useState(false);
	useEffect(() => {
		const update = () => setShow(hasAnalyticsConfigured() && getConsent() === 'unknown');
		update();
		return subscribeConsent(update);
	}, []);
	if (!show) return null;
	return (
		<div className="consent" role="dialog" aria-label="Aviso de cookies y analítica">
			<p>
				Usamos analítica anónima (Google Analytics y Microsoft Clarity) para mejorar el sitio. Solo se activa si lo aceptás; el contenido de tus datos y tu foto nunca se envía a esas herramientas.
			</p>
			<div className="actions-bar">
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setConsent('granted')}>Aceptar</button>
				<button type="button" className="btn btn-secondary btn-sm" onClick={() => setConsent('denied')}>Rechazar</button>
			</div>
		</div>
	);
}
