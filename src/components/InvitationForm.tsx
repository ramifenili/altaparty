'use client';

import React, {useId, useRef, useState} from 'react';
import {useInvitation} from '../state/InvitationProvider';
import {LIMITS, todayIso, validateInvitation, type FieldName} from '../domain/invitation';
import {Camera} from 'lucide-react';

function PhotoField() {
	const {state, setPhotoFile} = useInvitation();
	const inputRef = useRef<HTMLInputElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const id = useId();

	const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = ''; // permite volver a elegir el mismo archivo
		if (!file) return;
		setBusy(true);
		setError(null);
		try {
			await setPhotoFile(file);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'No pudimos cargar la foto.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="field f-photo">
			<span className="label" id={`${id}-l`}>
				Foto del cumpleañero/a <span className="opt">(opcional)</span>
			</span>
			<div className="photo-field" role="group" aria-labelledby={`${id}-l`}>
				{state.photo ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img className="photo-thumb" src={state.photo.previewUrl} alt="Foto elegida" />
				) : (
					<div className="photo-thumb" aria-hidden="true"><Camera size={22} /></div>
				)}
				<div className="photo-actions">
					<button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
						{state.photo ? 'Cambiar foto' : 'Subir foto'}
					</button>
					{state.photo && (
						<button type="button" className="btn btn-ghost btn-sm" onClick={() => void setPhotoFile(null)}>
							Quitar
						</button>
					)}
				</div>
				<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} aria-label="Elegir foto" />
			</div>
			<p className="hint">JPG, PNG o WebP de hasta 8 MB. Se usa solo en tu navegador. Sin foto, la invitación se adapta igual.</p>
			{error && <p className="error-text" role="alert">{error}</p>}
		</div>
	);
}

type Props = {
	submitLabel: string;
	/** ícono opcional delante del texto del botón principal */
	submitIcon?: React.ReactNode;
	onSubmit: () => void;
	onCancel?: () => void;
};

export function InvitationForm({submitLabel, submitIcon, onSubmit, onCancel}: Props) {
	const {state, setField} = useInvitation();
	const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
	const [submitted, setSubmitted] = useState(false);
	const uid = useId();
	const errors = validateInvitation(state.data);
	// los errores se muestran de a un campo: al salir de cada uno, o el primero pendiente al enviar
	const show = (f: FieldName) => touched[f] && errors[f];

	const field = (f: FieldName) => ({
		id: `${uid}-${f}`,
		value: state.data[f],
		className: 'input',
		'aria-invalid': show(f) ? (true as const) : undefined,
		'aria-describedby': show(f) ? `${uid}-${f}-e` : undefined,
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(f, e.target.value),
		onBlur: () => setTouched((t) => ({...t, [f]: true})),
	});
	const err = (f: FieldName) =>
		show(f) ? (
			<p className="error-text" id={`${uid}-${f}-e`} role="alert">
				{errors[f]}
			</p>
		) : null;

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitted(true);
		const keys = Object.keys(errors) as FieldName[];
		if (keys.length) {
			// lleva el foco al primer campo con error
			const order: FieldName[] = ['name', 'age', 'date', 'venue', 'address', 'time', 'timeEnd'];
			const first = order.find((k) => errors[k]);
			if (first) {
				setTouched((t) => ({...t, [first]: true}));
				document.getElementById(`${uid}-${first}`)?.focus();
			}
			return;
		}
		onSubmit();
	};

	const label = (f: FieldName, text: string) => (
		<label htmlFor={`${uid}-${f}`}>
			{text}
			<span className="req" aria-hidden="true"> *</span>
		</label>
	);

	/** Campo de texto que crece con el contenido y respeta los saltos de línea (salón y dirección). */
	const growing = (f: 'venue' | 'address', placeholder: string) => (
		<textarea
			{...field(f)}
			rows={1}
			autoComplete="off"
			autoCapitalize="words"
			placeholder={placeholder}
			required
			style={{resize: 'none', overflow: 'hidden', display: 'block', lineHeight: 1.4}}
			onChange={(e) => setField(f, e.target.value)}
			ref={(el) => {
				if (!el) return;
				el.style.height = 'auto';
				el.style.height = `${el.scrollHeight + 4}px`;
			}}
		/>
	);

	return (
		<form onSubmit={submit} noValidate className="form-grid" aria-label="Datos de la invitación">
			<p className="hint" style={{margin: 0}}>Los campos con <span className="req">*</span> son obligatorios.</p>
			<PhotoField />
			<div className="field f-name">
				{label('name', 'Nombre del cumpleañero/a')}
				<input {...field('name')} type="text" autoComplete="off" autoCapitalize="words" enterKeyHint="next" maxLength={LIMITS.name + 10} placeholder="Ej.: Mateo" required />
				{err('name')}
			</div>
			<div className="row-2">
				<div className="field f-age">
					{label('age', 'Edad que cumple')}
					<input {...field('age')} type="text" inputMode="numeric" enterKeyHint="next" maxLength={3} placeholder="Ej.: 7" required />
					{err('age')}
				</div>
				<div className="field f-date">
					{label('date', 'Fecha del evento')}
					<input {...field('date')} type="date" min={todayIso()} required />
					{err('date')}
				</div>
			</div>
			<div className="field f-venue">
				{label('venue', 'Nombre del salón o lugar')}
				{growing('venue', 'Ej.: Salón Los Pibes')}
				{err('venue')}
			</div>
			<div className="field f-address">
				{label('address', 'Dirección del salón o lugar')}
				{growing('address', 'Ej.: Av. Corrientes 1234, CABA')}
				{err('address')}
			</div>
			<div className="row-2">
				<div className="field f-time">
					{label('time', 'Horario desde')}
					<input {...field('time')} type="time" required />
					{err('time')}
				</div>
				<div className="field f-timeend">
					<label htmlFor={`${uid}-timeEnd`}>
						Hasta <span className="hint" style={{display: 'inline'}}>(opcional)</span>
					</label>
					<input {...field('timeEnd')} type="time" />
					{err('timeEnd')}
				</div>
			</div>
			{submitted && Object.keys(errors).length > 0 && Object.keys(errors).some((k) => touched[k as FieldName]) && (
				<p className="alert alert-error" role="alert">Revisá los campos marcados para continuar.</p>
			)}
			<div className="actions-bar">
				<button type="submit" className="btn btn-primary">{submitIcon}{submitLabel}</button>
				{onCancel && (
					<button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
				)}
			</div>
		</form>
	);
}
