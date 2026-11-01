'use client';

import React, {useMemo, useState} from 'react';
import {useSiteConfig} from '../state/SiteConfig';
import {SAMPLE_INVITATION, toTemplateContent} from '../domain/invitation';
import {TemplateCanvas} from '../components/TemplateCanvas';
import {adminApi} from './api';
import {fillTitle, matchesSearch, normalizeTags, SITE_NAME, SLUG_RE, slugify, stripSiteSuffix, templateSeo, templateSlug, type SeoFields} from '../lib/seo';
import {useSettings} from './useSettings';

/** Qué plantillas se muestran en el sitio y en qué orden. */
export function TemplatesTab() {
	const {all, base, config, reload} = useSiteConfig();
	const {settings, save, saving, msg} = useSettings();
	const sample = useMemo(() => toTemplateContent(SAMPLE_INVITATION, null), []);
	const [order, setOrder] = useState<string[] | null>(null);
	const [visible, setVisible] = useState<Record<string, boolean> | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const [seo, setSeo] = useState<Record<string, SeoFields>>({});
	const seoOf = (id: string): SeoFields => seo[id] ?? config.templates[id] ?? {};
	const setSeoField = (id: string, patch: SeoFields) => setSeo({...seo, [id]: {...seoOf(id), ...patch}});
	// nombre y categoría (la que se ve en la tarjeta de la galería); las etiquetas son ocultas y solo sirven para buscar
	// "Nueva categoría…" elegida en el desplegable de cada plantilla
	const [newLabel, setNewLabel] = useState<Record<string, boolean>>({});
	const [tab, setTab] = useState<'pub' | 'draft'>('pub');
	const [query, setQuery] = useState('');
	const [tagsText, setTagsText] = useState<Record<string, string>>({});
	const [labels, setLabels] = useState<Record<string, {name?: string; category?: string}>>({});
	// categorías que ya se usan (para elegirlas en vez de escribirlas de nuevo y que no se dupliquen)
	const usedLabels = useMemo(() => {
		const set = new Map<string, string>();
		for (const t of all) {
			const c = (labels[t.id]?.category ?? t.category ?? '').trim();
			if (c && !set.has(c.toLowerCase())) set.set(c.toLowerCase(), c);
		}
		for (const b of Object.values(base)) if (b.category && !set.has(b.category.toLowerCase())) set.set(b.category.toLowerCase(), b.category);
		return [...set.values()].sort((a, b) => a.localeCompare(b, 'es'));
	}, [all, base, labels]);
	const labelOf = (id: string) => labels[id] ?? {name: config.templates[id]?.name, category: config.templates[id]?.category};
	const setLabel = (id: string, patch: {name?: string; category?: string}) => setLabels({...labels, [id]: {...labelOf(id), ...patch}});
	// nombre con lo que se está escribiendo (en vivo), para que título, dirección y vista de Google se actualicen al tipear
	const nameOf = (id: string) => labelOf(id).name?.trim() || base[id]?.name || all.find((x) => x.id === id)?.name || '';
	const tagsOf = (id: string) => tagsText[id] ?? (config.templates[id]?.tags ?? []).join(', ');

	// estado de trabajo: orden y visibilidad a partir de la configuración actual
	const ids = useMemo(() => {
		if (order) return order;
		const rank = (id: string) => config.templates[id]?.order ?? all.findIndex((t) => t.id === id) * 10;
		return all.map((t) => t.id).sort((a, b) => rank(a) - rank(b));
	}, [order, all, config.templates]);
	const isVisible = (id: string) => {
		if (visible && id in visible) return visible[id];
		const t = all.find((x) => x.id === id);
		if (t?.spec) return t.spec.enabled && config.templates[id]?.enabled !== false;
		return config.templates[id]?.enabled !== false;
	};

	if (!settings) return <p className="alert alert-info">Cargando…</p>;

	const published = ids.filter(isVisible);
	const drafts = ids.filter((id) => !isVisible(id));
	const shown = (tab === 'pub' ? published : drafts).filter((id) => {
		const t = all.find((x) => x.id === id);
		return !!t && matchesSearch({name: nameOf(id), category: labelOf(id).category || t.category, tags: normalizeTags(tagsOf(id))}, query);
	});

	// sube/baja dentro de la lista que se está viendo
	const move = (id: string, d: -1 | 1) => {
		const list = tab === 'pub' ? published : drafts;
		const k = list.indexOf(id) + d;
		if (k < 0 || k >= list.length) return;
		const next = [...ids];
		const a = next.indexOf(id);
		const b = next.indexOf(list[k]);
		[next[a], next[b]] = [next[b], next[a]];
		setOrder(next);
	};

	const onSave = async () => {
		const templates: typeof settings.templates = {};
		ids.forEach((id, i) => {
			const t = all.find((x) => x.id === id);
			// los videos compilados se publican/ocultan en su propia definición
			const s = seoOf(id);
			const l = labelOf(id);
			const orig = base[id];
			const name = l.name?.trim() && l.name.trim() !== orig?.name ? l.name.trim() : undefined;
			const tags = normalizeTags(tagsOf(id));
			// si coincide (sin importar mayúsculas) con una etiqueta que ya existe, se usa esa para no duplicarla
			const typed = l.category?.trim() ? (usedLabels.find((u) => u.toLowerCase() === l.category!.trim().toLowerCase()) ?? l.category.trim()) : '';
			const category = typed && typed !== orig?.category ? typed : undefined;
			let slug = s.slug?.trim() || undefined;
			// al cambiar el nombre, la dirección de la página no cambia sola (se perdería el posicionamiento en Google)
			if (!slug && t && name && name !== t.name) slug = slugify(t.name) || undefined;
			templates[id] = {enabled: t?.spec ? true : isVisible(id), order: i * 10, slug, seoTitle: stripSiteSuffix(s.seoTitle?.trim() ?? '') || undefined, seoDescription: s.seoDescription?.trim() || undefined, name, category, tags: tags.length ? tags : undefined};
		});
		// publicar / ocultar videos compilados
		for (const t of all) {
			if (t.spec && isVisible(t.id) !== t.spec.enabled) {
				await adminApi.saveCompiled({...t.spec, enabled: isVisible(t.id)}).catch((e) => setNote(e.message));
			}
		}
		// los slugs deben ser únicos
		const slugs = ids.map((id) => {
			const t = all.find((x) => x.id === id);
			return t ? templateSlug(t, seoOf(id)) : id;
		});
		const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
		if (dup) {
			setNote(`La dirección "${dup}" está repetida en dos plantillas. Cambiá una.`);
			return;
		}
		setNote(null);
		const saved = await save({...settings, templates});
		if (saved) {
			setSeo({});
			setLabels({});
			setTagsText({});
			setNewLabel({});
			setOrder(null);
			setVisible(null);
			reload();
		}
	};

	return (
		<div className="stack">
			<p className="lead" style={{fontSize: 15}}>Elegí qué plantillas ven tus clientes y en qué orden. Una plantilla no publicada no aparece en el inicio, pero las compras ya hechas de esa plantilla siguen funcionando.</p>
			<div style={{display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center'}}>
				<nav className="admin-tabs" aria-label="Estado" style={{margin: 0}}>
					<button type="button" className="chip" aria-pressed={tab === 'pub'} onClick={() => setTab('pub')}>✅ Publicadas ({published.length})</button>
					<button type="button" className="chip" aria-pressed={tab === 'draft'} onClick={() => setTab('draft')}>🙈 No publicadas ({drafts.length})</button>
				</nav>
				<input type="search" className="input input-sm" style={{maxWidth: 260}} placeholder="Buscar por nombre, categoría o etiqueta…" aria-label="Buscar plantilla" value={query} onChange={(e) => setQuery(e.target.value)} />
			</div>
			{shown.length === 0 && <p className="alert alert-info">{query ? 'No hay plantillas con esa búsqueda.' : tab === 'pub' ? 'No hay plantillas publicadas.' : 'No hay plantillas sin publicar.'}</p>}
			<ul className="admin-list">
				{shown.map((id, i) => {
					const t0 = all.find((x) => x.id === id);
					if (!t0) return null;
					// la plantilla con el nombre que se está escribiendo
					const t = {...t0, name: nameOf(id)};
					return (
						<li key={id} className="panel admin-row" data-hidden={!isVisible(id)}>
							<div className="admin-thumb"><TemplateCanvas template={t} content={sample} scale={0.12} /></div>
							<div style={{flex: 1, minWidth: 0}}>
								<strong>{t.name}</strong> <span className="tag">{labelOf(id).category || t.category}</span> {t.spec ? <span className="tag tag-on">Compilado</span> : <span className="tag">Incluida</span>}
								<div className="fine" style={{margin: 0}}>{t.description}</div>
								<div className="row-fields" style={{display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8}}>
									<div className="field" style={{flex: '2 1 180px'}}>
										<label htmlFor={`nm-${id}`}>Nombre de la plantilla</label>
										<input id={`nm-${id}`} className="input input-sm" maxLength={60} value={labelOf(id).name ?? ''} placeholder={base[id]?.name} onChange={(e) => setLabel(id, {name: e.target.value})} />
									</div>
									<div className="field" style={{flex: '1 1 130px'}}>
										<label htmlFor={`cat-${id}`}>Categoría</label>
										<select
											id={`cat-${id}`}
											className="input input-sm"
											value={newLabel[id] ? '__new__' : (labelOf(id).category || all.find((x) => x.id === id)?.category || '')}
											onChange={(e) => {
												if (e.target.value === '__new__') {
													setNewLabel({...newLabel, [id]: true});
													setLabel(id, {category: ''});
												} else {
													setNewLabel({...newLabel, [id]: false});
													setLabel(id, {category: e.target.value});
												}
											}}
										>
											{usedLabels.map((l) => (
												<option key={l} value={l}>{l}</option>
											))}
											<option value="__new__">➕ Nueva categoría…</option>
										</select>
										{newLabel[id] && (
											<input className="input input-sm" style={{marginTop: 6}} autoFocus maxLength={30} placeholder="Nombre de la categoría nueva" aria-label="Nombre de la categoría nueva" value={labelOf(id).category ?? ''} onChange={(e) => setLabel(id, {category: e.target.value})} />
										)}
									</div>
									<div className="field" style={{flex: '2 1 200px'}}>
										<label htmlFor={`tg-${id}`}>Etiquetas ocultas <span className="opt">solo para buscar</span></label>
										<input id={`tg-${id}`} className="input input-sm" placeholder="fútbol, boca, azul y oro" value={tagsOf(id)} onChange={(e) => setTagsText({...tagsText, [id]: e.target.value})} />
										<p className="hint">Separadas por coma. No se muestran: ayudan a encontrar el diseño en el buscador.</p>
									</div>
								</div>
							</div>
							<label className="switch">
								<input type="checkbox" checked={isVisible(id)} onChange={(e) => setVisible({...(visible ?? {}), [id]: e.target.checked})} />
								<span>{isVisible(id) ? 'Publicada' : 'No publicada'}</span>
							</label>
							<details className="seo-box">
								<summary>SEO y dirección (URL)</summary>
								{(() => {
									const s = seoOf(id);
									// si cambiaste el nombre y no tocaste la dirección, la actual se mantiene (cambiarla sola haría perder el posicionamiento en Google)
									const renamed = nameOf(id) !== t0.name;
									const slug = s.slug?.trim() || (renamed ? slugify(t0.name) : templateSlug(t, s)) || id;
									const suggested = slugify(nameOf(id));
									const def = templateSeo(t, {});
									const cur = templateSeo(t, s);
									const url = `${typeof window === 'undefined' ? '' : window.location.origin}/invitacion/${slug}`;
									return (
										<div className="stack" style={{gap: 10, marginTop: 10}}>
											<div className="field">
												<label htmlFor={`slug-${id}`}>Dirección de la página</label>
												<input
													id={`slug-${id}`}
													className="input input-sm"
													value={s.slug ?? ''}
													placeholder={slug}
													onChange={(e) => setSeoField(id, {slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-')})}
													aria-invalid={s.slug && !SLUG_RE.test(s.slug) ? true : undefined}
												/>
												{suggested && suggested !== slug && (
													<p className="hint">Sugerida con el nombre nuevo: <code>{suggested}</code>{' '}<button type="button" className="link" onClick={() => setSeoField(id, {slug: suggested})}>Usar esta</button></p>
												)}
												<p className="hint">Solo minúsculas, números y guiones. Queda: <a href={url} target="_blank" rel="noreferrer"><code>{url}</code> ↗</a></p>
											</div>
											<div className="field">
												<label htmlFor={`st-${id}`}>Título (Google y pestaña) <span className="opt">{cur.title.length}/80 · ideal 50–60</span></label>
												<div style={{display: 'flex', alignItems: 'center', gap: 8}}>
													<input id={`st-${id}`} className="input input-sm" style={{flex: 1}} maxLength={80 - SITE_NAME.length - 3} value={stripSiteSuffix(s.seoTitle ?? '')} placeholder={stripSiteSuffix(def.title)} onChange={(e) => setSeoField(id, {seoTitle: stripSiteSuffix(e.target.value)})} />
													<span className="fine" style={{margin: 0, whiteSpace: 'nowrap'}} title="Se agrega siempre al final del título">| {SITE_NAME}</span>
												</div>
											</div>
											<div className="field">
												<label htmlFor={`sd-${id}`}>Descripción <span className="opt">{(s.seoDescription ?? '').length}/200 · ideal 120–160</span></label>
												<textarea id={`sd-${id}`} className="input input-sm" rows={2} maxLength={200} value={s.seoDescription ?? ''} placeholder={def.description} onChange={(e) => setSeoField(id, {seoDescription: e.target.value})} />
											</div>
											<div className="snippet" aria-label="Así se ve en Google">
												<span className="snippet-url">{url.replace(/^https?:\/\//, '')}</span>
												<span className="snippet-title">{cur.title}</span>
												<span className="snippet-desc">{cur.description}</span>
											</div>
											<p className="hint">Podés escribir <code>{'{title}'}</code> en el título o la descripción y se reemplaza por el nombre de la plantilla (ahora: <em>{fillTitle('{title}', t.name)}</em>).</p>
											<p className="hint">Dejá los campos vacíos para usar el texto automático ({SITE_NAME}). Guardá con el botón de abajo.</p>
										</div>
									);
								})()}
							</details>
							<div className="admin-move">
								<button type="button" className="icon-btn" aria-label={`Subir ${t.name}`} onClick={() => move(id, -1)} disabled={i === 0}>▲</button>
								<button type="button" className="icon-btn" aria-label={`Bajar ${t.name}`} onClick={() => move(id, 1)} disabled={i === shown.length - 1}>▼</button>
							</div>
						</li>
					);
				})}
			</ul>
			<div className="actions-bar">
				<button type="button" className="btn btn-primary" onClick={() => void onSave()} disabled={saving}>
					{saving && <span className="spinner" aria-hidden="true" />} Guardar orden y visibilidad
				</button>
			</div>
			{note && <p className="alert alert-error">{note}</p>}
			{msg && <p className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</p>}
		</div>
	);
}
