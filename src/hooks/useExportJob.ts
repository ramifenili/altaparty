'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {Phase, Progress} from '../render/engine';

export type JobState = {
	status: 'idle' | 'running' | 'error' | 'done';
	phase: Phase;
	/** progreso real del procesamiento (0..1); solo llega a 1 cuando el trabajo terminó */
	overall: number;
	/** el render real ya terminó y se completa el tiempo mínimo de la pantalla */
	finishing: boolean;
	error: string | null;
	warning: string | null;
};

const IDLE: JobState = {status: 'idle', phase: 'prepare', overall: 0, finishing: false, error: null, warning: null};

export function useExportJob() {
	const [state, setState] = useState<JobState>(IDLE);
	const running = useRef(false);
	const abort = useRef<AbortController | null>(null);

	useEffect(() => () => abort.current?.abort(), []);

	/**
	 * Ejecuta un render. Solo permite uno a la vez (los clics repetidos se ignoran).
	 * `minMs` garantiza una duración mínima de la experiencia SIN agregar espera si el render ya tardó más.
	 */
	const start = useCallback(
		async (run: (ctl: {signal: AbortSignal; onProgress: (p: Progress) => void}) => Promise<Blob>, minMs = 0, warning: string | null = null) => {
			if (running.current) return null;
			running.current = true;
			const ctrl = new AbortController();
			abort.current = ctrl;
			const t0 = performance.now();
			setState({...IDLE, status: 'running', warning});
			try {
				const blob = await run({
					signal: ctrl.signal,
					onProgress: (p) => setState((s) => (s.status === 'running' ? {...s, phase: p.phase, overall: Math.max(s.overall, p.overall)} : s)),
				});
				const remaining = minMs - (performance.now() - t0);
				if (remaining > 0) {
					setState((s) => ({...s, finishing: true, phase: 'finish'}));
					await new Promise((r) => setTimeout(r, remaining));
				}
				if (ctrl.signal.aborted) return null;
				setState((s) => ({...s, status: 'done', overall: 1, finishing: false, phase: 'finish'}));
				return blob;
			} catch (e) {
				if (!ctrl.signal.aborted) {
					setState((s) => ({...s, status: 'error', finishing: false, error: e instanceof Error ? e.message : 'Ocurrió un error inesperado.'}));
				}
				return null;
			} finally {
				running.current = false;
			}
		},
		[]
	);

	const cancel = useCallback(() => {
		abort.current?.abort();
		setState(IDLE);
	}, []);

	const reset = useCallback(() => setState(IDLE), []);

	return {state, start, cancel, reset, isRunning: state.status === 'running'};
}
