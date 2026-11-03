'use client';

import React, {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef} from 'react';
import {EMPTY_INVITATION, toTemplateContent, type FieldName, type InvitationData} from '../domain/invitation';
import type {TemplateContent, TemplateDefinition, TemplateId} from '../templates/types';
import {useSiteConfig} from './SiteConfig';
import type {AudioSelection, ResolvedAudio} from '../audio/library';
import {resolveAudio} from '../audio/library';
import {loadPhoto, readAudioDuration, validateAudioFile, type LoadedPhoto} from '../render/assets';
import {loadSavedFile, removeFile, saveFile} from './blobStore';

export type Step = 'form' | 'studio' | 'processing' | 'offer' | 'generator';

export type PreviewResult = {url: string; blob: Blob; templateId: TemplateId};

type State = {
	hydrated: boolean;
	step: Step;
	data: InvitationData;
	photo: LoadedPhoto | null;
	templateId: TemplateId;
	/** cuántas veces el usuario eligió plantilla (para actualizar título y URL solo tras una elección) */
	templateSeq: number;
	audio: AudioSelection;
	preview: PreviewResult | null;
};

type Action =
	| {type: 'hydrate'; data: InvitationData; templateId: TemplateId; audio: AudioSelection}
	| {type: 'field'; field: FieldName; value: string}
	| {type: 'replaceData'; data: InvitationData}
	| {type: 'photo'; photo: LoadedPhoto | null}
	| {type: 'template'; id: TemplateId}
	| {type: 'audio'; audio: AudioSelection}
	| {type: 'step'; step: Step}
	| {type: 'preview'; preview: PreviewResult | null};

const initial: State = {
	hydrated: false,
	step: 'form',
	data: EMPTY_INVITATION,
	photo: null,
	templateId: 'boca',
	templateSeq: 0,
	audio: {kind: 'default'},
	preview: null,
};

function reducer(s: State, a: Action): State {
	switch (a.type) {
		case 'hydrate':
			return {...s, hydrated: true, data: a.data, templateId: a.templateId, audio: a.audio};
		case 'field':
			return {...s, data: {...s.data, [a.field]: a.value}};
		case 'replaceData':
			return {...s, data: a.data};
		case 'photo':
			return {...s, photo: a.photo};
		case 'template':
			// el audio NO se toca: si es "default" sigue a la plantilla nueva; si el usuario eligió otro, se conserva
			return {...s, templateId: a.id, templateSeq: s.templateSeq + 1};
		case 'audio':
			return {...s, audio: a.audio};
		case 'step':
			return {...s, step: a.step};
		case 'preview':
			return {...s, preview: a.preview};
	}
}

const STORAGE_KEY = 'invitacion:v1';

type Persisted = {data: InvitationData; templateId: TemplateId; audio: {kind: 'default' | 'mute'} | {kind: 'library'; id: string}};

type Ctx = {
	state: State;
	content: TemplateContent;
	template: TemplateDefinition;
	resolvedAudio: ResolvedAudio;
	setField: (f: FieldName, v: string) => void;
	setPhotoFile: (file: File | null) => Promise<void>;
	setTemplate: (id: TemplateId) => void;
	setAudio: (a: AudioSelection) => void;
	setCustomAudio: (file: File) => Promise<void>;
	goto: (s: Step) => void;
	setPreview: (p: PreviewResult | null) => void;
	/** Reemplaza datos, foto y música por los de una compra (el generador de compra es de solo lectura). */
	applyPurchased: (data: InvitationData, audio: AudioSelection, photoFile: File | null) => Promise<void>;
};

const InvitationContext = createContext<Ctx | null>(null);

export function InvitationProvider({children, initialTemplateId}: {children: React.ReactNode; initialTemplateId?: string}) {
	const {getTemplate, loaded, catalog} = useSiteConfig();
	const [state, dispatch] = useReducer(reducer, initial);
	const latest = useRef(state);
	latest.current = state;

	// Recupera los datos de texto de una visita anterior (las fotos y audios propios no se guardan).
	useEffect(() => {
		let data = EMPTY_INVITATION;
		let templateId: TemplateId = 'boca';
		let audio: AudioSelection = {kind: 'default'};
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const p = JSON.parse(raw) as Persisted;
				data = {...EMPTY_INVITATION, ...p.data};
				if (typeof p.templateId === 'string' && /^[a-z0-9-]{2,40}$/.test(p.templateId)) templateId = p.templateId;
				if (p.audio.kind === 'library' || p.audio.kind === 'mute') audio = p.audio;
			}
		} catch {
			/* almacenamiento no disponible o corrupto */
		}
		dispatch({type: 'hydrate', data, templateId: initialTemplateId ?? templateId, audio});
		// foto y audio propio guardados en IndexedDB
		(async () => {
			const photoFile = await loadSavedFile('photo');
			if (photoFile) {
				try {
					dispatch({type: 'photo', photo: await loadPhoto(photoFile)});
				} catch {
					await removeFile('photo');
				}
			}
			const audioFile = await loadSavedFile('audio');
			if (audioFile && !validateAudioFile(audioFile)) {
				const url = URL.createObjectURL(audioFile);
				dispatch({type: 'audio', audio: {kind: 'custom', file: audioFile, url, name: audioFile.name, duration: await readAudioDuration(url)}});
			}
		})();
	}, []);

	useEffect(() => {
		if (!state.hydrated) return;
		const audio: Persisted['audio'] =
			state.audio.kind === 'library'
				? state.audio
				: state.audio.kind === 'mute'
					? {kind: 'mute'}
					: {kind: 'default'};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({data: state.data, templateId: state.templateId, audio} satisfies Persisted));
		} catch {
			/* modo privado o cuota llena */
		}
	}, [state.hydrated, state.data, state.templateId, state.audio]);

	// Libera los ObjectURL cuando dejan de usarse
	useEffect(() => () => {
		const s = latest.current;
		if (s.photo) URL.revokeObjectURL(s.photo.previewUrl);
		const cust = s.audio.kind === 'custom' ? s.audio : s.audio.kind === 'mute' && s.audio.previous?.kind === 'custom' ? s.audio.previous : null;
		if (cust) URL.revokeObjectURL(cust.url);
		if (s.preview) URL.revokeObjectURL(s.preview.url);
	}, []);

	/** Carga una foto nueva (o la quita con null). Lanza un Error con mensaje en español si no es válida. */
	const setPhotoFile = useCallback(async (file: File | null) => {
		if (!file) {
			const old = latest.current.photo;
			if (old) URL.revokeObjectURL(old.previewUrl);
			dispatch({type: 'photo', photo: null});
			void removeFile('photo');
			return;
		}
		const photo = await loadPhoto(file);
		const old = latest.current.photo;
		if (old) URL.revokeObjectURL(old.previewUrl);
		dispatch({type: 'photo', photo});
		void saveFile('photo', file);
	}, []);

	/** Elige un audio de la biblioteca, el predeterminado, silencio o restaura una elección previa. */
	const setAudio = useCallback((audio: AudioSelection) => {
		const old = latest.current.audio;
		const customOf = (a: AudioSelection) => (a.kind === 'custom' ? a : a.kind === 'mute' && a.previous?.kind === 'custom' ? a.previous : null);
		const keep = customOf(audio)?.url;
		const prev = customOf(old);
		if (prev && prev.url !== keep) {
			URL.revokeObjectURL(prev.url);
			void removeFile('audio');
		}
		dispatch({type: 'audio', audio});
	}, []);

	/** Usa un audio subido por el usuario. Lanza un Error en español si no es válido. */
	const setCustomAudio = useCallback(async (file: File) => {
		const err = validateAudioFile(file);
		if (err) throw new Error(err);
		const url = URL.createObjectURL(file);
		const duration = await readAudioDuration(url);
		if (duration === null) {
			URL.revokeObjectURL(url);
			throw new Error('No pudimos leer ese audio. Probá con un MP3 o WAV.');
		}
		setAudio({kind: 'custom', file, url, name: file.name, duration});
		void saveFile('audio', file);
	}, [setAudio]);

	const setPreview = useCallback((preview: PreviewResult | null) => {
		const old = latest.current.preview;
		if (old && old.url !== preview?.url) URL.revokeObjectURL(old.url);
		dispatch({type: 'preview', preview});
	}, []);

	const applyPurchased = useCallback(async (data: InvitationData, audio: AudioSelection, photoFile: File | null) => {
		const oldPhoto = latest.current.photo;
		if (oldPhoto) URL.revokeObjectURL(oldPhoto.previewUrl);
		dispatch({type: 'photo', photo: photoFile ? await loadPhoto(photoFile) : null});
		dispatch({type: 'replaceData', data});
		setAudio(audio);
	}, [setAudio]);

	// si la plantilla recordada (o la inicial) está oculta, se pasa a la primera publicada; solo se revisa una vez
	const checkedTemplate = useRef(false);
	useEffect(() => {
		if (checkedTemplate.current || !loaded || !state.hydrated || initialTemplateId) return;
		checkedTemplate.current = true;
		if (catalog.length && !catalog.some((t) => t.id === latest.current.templateId)) dispatch({type: 'template', id: catalog[0].id});
	}, [loaded, state.hydrated, catalog, initialTemplateId]);

	const template = getTemplate(state.templateId);
	const photoCanvas = state.photo?.canvas ?? null;
	const content = useMemo(() => toTemplateContent(state.data, photoCanvas), [state.data, photoCanvas]);
	const resolvedAudio = useMemo(
		() => resolveAudio(state.audio, template.defaultAudioId),
		[state.audio, template.defaultAudioId]
	);

	const value: Ctx = {
		state,
		content,
		template,
		resolvedAudio,
		setField: useCallback((field, v) => dispatch({type: 'field', field, value: v}), []),
		setPhotoFile,
		setTemplate: useCallback(
			(id) => {
				// al cambiar de plantilla, si se había quitado la música vuelve la de la plantilla elegida
				if (id !== latest.current.templateId && latest.current.audio.kind === 'mute') setAudio({kind: 'default'});
				dispatch({type: 'template', id});
			},
			[setAudio]
		),
		setAudio,
		setCustomAudio,
		goto: useCallback((step) => dispatch({type: 'step', step}), []),
		setPreview,
		applyPurchased,
	};
	return <InvitationContext.Provider value={value}>{children}</InvitationContext.Provider>;
}

export function useInvitation() {
	const ctx = useContext(InvitationContext);
	if (!ctx) throw new Error('useInvitation debe usarse dentro de <InvitationProvider>');
	return ctx;
}
