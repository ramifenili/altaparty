'use client';

import React, {useRef, useState} from 'react';
import {ApiError, fetchPurchase, type PurchaseInfo} from '../client/purchases';
import {PURCHASE_KEY} from './OfferPanel';

/** Permite retomar una compra pagada (por ejemplo, si se cerró la pestaña antes de descargar). */
export function RecoverPurchase({onFound, open}: {onFound: (info: PurchaseInfo) => void; open?: boolean}) {
	const [code, setCode] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const lock = useRef(false);
	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const value = code.trim();
		if (!value) return setError('Pegá el código de compra que recibiste.');
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setError(null);
		try {
			const p = await fetchPurchase(value);
			if (p.status === 'expired') {
				setError('Esa compra venció: ya pasó el plazo para descargar y los datos se eliminaron.');
				return;
			}
			if (p.status !== 'approved') {
				setError(p.status === 'pending' ? 'Ese pago todavía está pendiente de acreditación.' : 'No encontramos un pago aprobado con ese código.');
				return;
			}
			try {
				localStorage.setItem(PURCHASE_KEY, JSON.stringify({purchaseId: p.purchaseId}));
			} catch { /* sin almacenamiento */ }
			onFound(p);
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'No pudimos verificar el código.');
		} finally {
			lock.current = false;
			setBusy(false);
		}
	};

	return (
		<details className="panel" style={{marginTop: 16}} open={open}>
			<summary style={{cursor: 'pointer', fontWeight: 700}}>¿Ya compraste tu video? Recuperalo con tu código</summary>
			<form onSubmit={submit} className="form-grid" noValidate>
				<div className="field">
					<label htmlFor="recover-code">Código de compra</label>
					<input id="recover-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.plantilla" autoComplete="off" aria-invalid={error ? true : undefined} />
					{error && <p className="error-text" role="alert">{error}</p>}
					<p className="hint">Lo encontrás en esta pantalla después de pagar. Te llevamos al generador con tu plantilla comprada (con un máximo de generaciones por compra).</p>
				</div>
				<button type="submit" className="btn btn-secondary" disabled={busy}>
					{busy && <span className="spinner" aria-hidden="true" />} Verificar compra
				</button>
			</form>
		</details>
	);
}
