'use client';

import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {DEFAULT_SETTINGS, type PublicConfig} from '../config/site';
import {PRICING} from '../config/pricing';
import type {TemplateDefinition} from '../templates/types';
import {TEMPLATES} from '../templates/registry';
import {buildCompiledTemplate} from '../templates/compiled';
import {setWatermarkConfig} from '../render/watermark';
import {setAnalyticsIds} from '../lib/analytics';

const DEFAULT_PUBLIC: PublicConfig = {
	pricing: {
		price: DEFAULT_SETTINGS.price,
		imagePrice: DEFAULT_SETTINGS.imagePrice,
		bundlePrice: DEFAULT_SETTINGS.bundlePrice,
		videoUpgrade: DEFAULT_SETTINGS.videoUpgrade,
		imageUpgrade: DEFAULT_SETTINGS.imageUpgrade,
		referencePrice: DEFAULT_SETTINGS.referencePrice,
		showReferencePrice: DEFAULT_SETTINGS.showReferencePrice,
		maxFinalRenders: DEFAULT_SETTINGS.maxFinalRenders,
		retentionDays: DEFAULT_SETTINGS.retentionDays,
		currency: PRICING.currency,
	},
	watermark: DEFAULT_SETTINGS.watermark,
	templates: {},
	analytics: {gaId: '', clarityId: ''},
	compiled: [],
};

type Ctx = {
	config: PublicConfig;
	loaded: boolean;
	/** plantillas visibles en la galería, ordenadas */
	catalog: TemplateDefinition[];
	/** todas las plantillas (incluidas las ocultas): para el admin */
	all: TemplateDefinition[];
	/** nombre y etiqueta originales de cada plantilla (sin lo que editó el admin) */
	base: Record<string, {name: string; category: string}>;
	/** busca cualquier plantilla (aunque esté oculta, para compras ya hechas) */
	getTemplate: (id: string) => TemplateDefinition;
	/** vuelve a pedir la configuración al servidor */
	reload: () => void;
};

const SiteConfigContext = createContext<Ctx | null>(null);

/** Carga la configuración pública (precio, marca de agua, plantillas visibles, videos compilados). */
export function SiteConfigProvider({children}: {children: React.ReactNode}) {
	const [config, setConfig] = useState<PublicConfig>(DEFAULT_PUBLIC);
	const [loaded, setLoaded] = useState(false);

	const [tick, setTick] = useState(0);
	useEffect(() => {
		let alive = true;
		fetch('/api/config', {cache: 'no-store'})
			.then((r) => (r.ok ? (r.json() as Promise<PublicConfig>) : null))
			.then((c) => {
				if (alive && c) setConfig(c);
			})
			.catch(() => undefined)
			.finally(() => alive && setLoaded(true));
		return () => {
			alive = false;
		};
	}, [tick]);

	useEffect(() => {
		setWatermarkConfig(config.watermark);
		setAnalyticsIds(config.analytics);
	}, [config]);

	const value = useMemo<Ctx>(() => {
		const compiled = config.compiled.map(buildCompiledTemplate);
		const original = [...TEMPLATES, ...compiled];
		const base: Record<string, {name: string; category: string}> = {};
		for (const t of original) base[t.id] = {name: t.name, category: t.category};
		// el nombre y la etiqueta que editó el admin reemplazan a los originales
		const all = original.map((t) => {
			const o = config.templates[t.id];
			return o?.name || o?.category || o?.tags ? {...t, name: o.name || t.name, category: o.category || t.category, tags: o.tags} : t;
		});
		const compiledEnabled = new Set(config.compiled.filter((c) => c.enabled).map((c) => c.id));
		const visible = all.filter((t) => {
			const o = config.templates[t.id];
			if (t.id.startsWith('c-')) return compiledEnabled.has(t.id) && o?.enabled !== false;
			return o?.enabled !== false;
		});
		const order = (t: TemplateDefinition) => config.templates[t.id]?.order ?? all.indexOf(t) * 10;
		// hasta que llega la configuración no se muestra ninguna: así no se cargan plantillas que después resultan ocultas
		const catalog = loaded ? [...visible].sort((a, b) => order(a) - order(b)) : [];
		return {
			config,
			loaded,
			catalog,
			all,
			base,
			reload: () => setTick((n) => n + 1),
			getTemplate: (id) => all.find((t) => t.id === id) ?? catalog[0] ?? TEMPLATES[0],
		};
	}, [config, loaded]);

	return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig() {
	const ctx = useContext(SiteConfigContext);
	if (!ctx) throw new Error('useSiteConfig debe usarse dentro de <SiteConfigProvider>');
	return ctx;
}
