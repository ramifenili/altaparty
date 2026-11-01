'use client';

import {useCallback, useEffect, useState} from 'react';
import type {SiteSettings} from '../config/site';
import {adminApi} from './api';
import {useSiteConfig} from '../state/SiteConfig';

/** Carga y guarda los ajustes del sitio (cada guardado actualiza también lo que ve el sitio público). */
export function useSettings() {
	const [settings, setSettings] = useState<SiteSettings | null>(null);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
	const {reload} = useSiteConfig();

	useEffect(() => {
		adminApi.getSettings().then(setSettings).catch((e) => setMsg({ok: false, text: e.message}));
	}, []);

	const save = useCallback(
		async (next: SiteSettings) => {
			setSaving(true);
			setMsg(null);
			try {
				const saved = await adminApi.saveSettings(next);
				setSettings(saved);
				setMsg({ok: true, text: 'Guardado. El sitio ya usa estos valores.'});
				reload();
				return saved;
			} catch (e) {
				setMsg({ok: false, text: e instanceof Error ? e.message : 'No se pudo guardar.'});
				return null;
			} finally {
				setSaving(false);
			}
		},
		[reload]
	);

	return {settings, setSettings, save, saving, msg};
}
