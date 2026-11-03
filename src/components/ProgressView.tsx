'use client';

import React from 'react';
import type {JobState} from '../hooks/useExportJob';
import type {Phase} from '../render/engine';

const PHASES: {phase: Phase; label: string}[] = [
	{phase: 'prepare', label: 'Preparando tu invitación...'},
	{phase: 'frames', label: 'Organizando las animaciones...'},
	{phase: 'audio', label: 'Incorporando la música...'},
	{phase: 'encode', label: 'Generando tu video...'},
	{phase: 'finish', label: 'Preparando la vista previa...'},
];
const ORDER: Phase[] = ['prepare', 'frames', 'audio', 'encode', 'finish'];

/** Barra y fases del procesamiento. Los porcentajes son los reales del render; en la espera final no se inventa ninguno. */
export function ProgressView({job, finalLabel, title}: {job: JobState; finalLabel?: string; /** título fijo (p. ej. "Generando tu video…"); la fase actual pasa a la línea del porcentaje */ title?: string}) {
	const idx = ORDER.indexOf(job.phase);
	const pct = Math.floor(Math.min(job.status === 'done' ? 100 : 99, job.overall * 100));
	const indeterminate = job.finishing;
	const current = PHASES[Math.max(0, idx)];
	const label = job.finishing && finalLabel ? finalLabel : current.label;

	return (
		<div style={{width: '100%', display: 'grid', gap: 16, justifyItems: 'center'}}>
			<h2 style={{fontSize: 26}} aria-live="polite">{title ?? label}</h2>
			<div
				className={`progress${indeterminate ? ' indeterminate' : ''}`}
				role="progressbar"
				aria-label="Progreso de la generación"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={indeterminate ? undefined : pct}
			>
				<div style={{width: `${pct}%`}} />
			</div>
			<p className="fine" style={{margin: 0}}>
				{indeterminate ? 'Ya casi: terminando los últimos detalles' : title ? `${pct}% · ${label.replace(/\.{3}$/, '')}` : `${pct}%`}
			</p>
			<ul className="phase-list">
				{PHASES.map((p, i) => {
					const state = i < idx || job.status === 'done' ? 'done' : i === idx ? 'active' : 'todo';
					return (
						<li key={p.phase} data-state={state}>
							<span className="dot" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
							{p.label}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
