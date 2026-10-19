'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { FieldDescription, FieldError, FieldLabel, useConfig, useDocumentInfo, useField, useFormFields, useFormModified, useLocale, withCondition } from '@payloadcms/ui';
import { validateContent } from './content.js';
import { mergePresetValues, presetValues } from './presets.js';
import { resolveLiveEditURL } from './live-edit-url.js';
// Shared scripts/styles, independent editor roots. Keep the promises between
// route changes and concurrent field mounts; a failed load can be retried.
const resources = new Map();
function loadResource(url, stylesheet = false) {
    const existing = resources.get(url);
    if (existing)
        return existing;
    const promise = new Promise((resolve, reject) => {
        const node = document.createElement(stylesheet ? 'link' : 'script');
        if (node instanceof HTMLLinkElement) {
            node.rel = 'stylesheet';
            node.href = url;
        }
        else {
            node.src = url;
            node.async = true;
        }
        const timeout = window.setTimeout(() => fail(), 20000);
        function fail() {
            window.clearTimeout(timeout);
            node.remove();
            resources.delete(url);
            reject(new Error('Unable to load Page Composer. Check your connection and reload this page.'));
        }
        node.onload = () => { window.clearTimeout(timeout); resolve(); };
        node.onerror = fail;
        document.head.appendChild(node);
    });
    resources.set(url, promise);
    return promise;
}
async function loadRuntime(base) {
    const runtime = window;
    await Promise.all(['editor.css', 'adapter.css', 'content.css'].map(file => loadResource(`${base}/assets/${file}?v=0.2.2`, true)));
    if (!runtime.pce?.payloadLicenseRequired)
        await loadResource(`${base}/assets/pceditor_payloadcms.js?v=0.2.2`);
    if (!runtime.PageComposerPayload)
        await loadResource(`${base}/assets/adapter.js?v=0.2.2`);
    return runtime.PageComposerPayload;
}
/** Dashboard notice; individual fields also show verification errors before mounting. */
export function PageComposerLicenseNotice() {
    const { config } = useConfig();
    const [message, setMessage] = useState('');
    useEffect(() => {
        const abort = new AbortController();
        void fetch(`${config.routes.api}/page-composer/license`, { credentials: 'same-origin', signal: abort.signal })
            .then(response => { if (!response.ok)
            throw new Error('License check failed'); return response.json(); })
            .then(result => setMessage(result.ok ? '' : result.message))
            .catch(() => { if (!abort.signal.aborted)
            setMessage('Unable to check the Page Composer license. Open an editor field to retry.'); });
        return () => abort.abort();
    }, [config.routes.api]);
    return message ? _jsxs("div", { role: "alert", style: { margin: '16px 0', padding: 16, background: '#fff8e6', color: '#663c00', border: '1px solid #e5a126', borderRadius: 6 }, children: [_jsx("strong", { children: "Page Composer: " }), message, " ", _jsx("a", { href: "https://page-composer.com/account/downloads", target: "_blank", rel: "noreferrer", children: "Manage license" })] }) : null;
}
export function PageComposerCanvas({ value, onChange, apiURL = '/api', mode = 'widget', readOnly = false, height = 640, title = 'Page Composer' }) {
    const surface = useRef(null);
    const controller = useRef(null);
    const latest = useRef({ value, onChange, mode, readOnly });
    latest.current = { value, onChange, mode, readOnly };
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let disposed = false;
        const abort = new AbortController();
        // An imperative child lets the nested root finish unmounting after the host
        // commit without racing a Strict Mode remount into that same DOM element.
        const root = document.createElement('div');
        surface.current.appendChild(root);
        let mounted;
        setReady(false);
        setError('');
        const timeout = window.setTimeout(() => abort.abort(), 20000);
        const start = async () => {
            try {
                const response = await fetch(`${apiURL}/page-composer/config`, { credentials: 'same-origin', signal: abort.signal });
                const settings = await response.json();
                if (!response.ok)
                    throw new Error(settings.errors?.[0]?.message || 'Unable to load editor configuration.');
                const runtime = await loadRuntime(settings.base);
                if (disposed)
                    return;
                mounted = runtime.mount(root, settings, {
                    value: latest.current.value ?? [], mode: latest.current.mode, readOnly: latest.current.readOnly,
                    onChange: next => {
                        if (disposed || latest.current.readOnly)
                            return;
                        const validation = validateContent(next);
                        if (validation === true) {
                            setError('');
                            latest.current.onChange(next);
                        }
                        else
                            setError(validation);
                    },
                    onError: message => { if (!disposed)
                        setError(message); },
                });
                controller.current = mounted;
                setReady(true);
            }
            catch (err) {
                if (!disposed)
                    setError(err instanceof Error ? err.message : 'Unable to load Page Composer.');
            }
            finally {
                window.clearTimeout(timeout);
            }
        };
        void start();
        return () => {
            disposed = true;
            abort.abort();
            window.clearTimeout(timeout);
            controller.current = null;
            if (mounted)
                mounted.destroy();
            else
                root.remove();
        };
    }, [apiURL]);
    useEffect(() => { controller.current?.update({ value: value ?? [], mode, readOnly }); }, [value, mode, readOnly]);
    return _jsxs("div", { style: { width: '100%' }, children: [_jsx("small", { children: readOnly ? 'Read-only content' : 'Changes are saved with the document. “Save template” stores a reusable layout.' }), error && _jsx("div", { role: "alert", style: { padding: 12, color: '#b42318' }, children: error }), !ready && !error && _jsx("div", { role: "status", children: "Loading Page Composer\u2026" }), _jsx("div", { ref: surface, className: "page-composer-surface", role: "region", "aria-label": title, style: { minHeight: height } })] });
}
function ComposerField(props) {
    const { field, path: pathFromProps, readOnly, height, liveEditURL } = props;
    const { config } = useConfig();
    const document = useDocumentInfo();
    const modified = useFormModified();
    const locale = useLocale();
    const { value, setValue, path, disabled, formProcessing, showError } = useField({
        potentiallyStalePath: pathFromProps,
        validate: (value, options) => props.validate
            ? props.validate(value, { ...options, name: field.name, type: 'json', required: field.required })
            : validateContent(value, field.required),
    });
    const locked = Boolean(readOnly || disabled || formProcessing || document.documentIsLocked || document.hasSavePermission === false);
    const saved = Boolean(document.globalSlug || document.id != null);
    const liveURL = resolveLiveEditURL(liveEditURL, {
        ...(document.data || document.initialData || {}),
        id: document.id, collection: document.collectionSlug, global: document.globalSlug,
        locale: locale?.code, fieldPath: path,
    });
    const liveHint = !saved ? 'Save this document before opening the frontend editor.'
        : locked ? 'Frontend editing is unavailable while this field is read-only or saving.'
            : modified ? 'Save your changes before opening the frontend editor.'
                : !liveURL ? 'Save the fields used by the frontend editing URL before opening it.'
                    : 'Opens the frontend editor in a new tab using the saved content.';
    const canOpenLive = saved && !locked && !modified && Boolean(liveURL);
    const actionStyle = {
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 4,
        border: '1px solid var(--theme-elevation-300)', background: 'var(--theme-elevation-50)',
        color: 'var(--theme-text)', textDecoration: 'none', font: 'inherit', fontWeight: 600,
    };
    return _jsxs("div", { className: `field-type page-composer-field${showError ? ' error' : ''}`, style: { marginBottom: 24 }, children: [_jsx(FieldLabel, { htmlFor: path, label: field.label, required: field.required, localized: field.localized }), _jsx(FieldError, { path: path }), liveEditURL && _jsxs("div", { className: "page-composer-field-actions", style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: '8px 0 16px' }, children: [canOpenLive
                        ? _jsxs("a", { href: liveURL, target: "_blank", rel: "noopener noreferrer", "aria-describedby": `${path}-live-hint`, style: actionStyle, children: ["Edit live ", _jsx("span", { "aria-hidden": "true", children: "\u2197" })] })
                        : _jsxs("button", { type: "button", disabled: true, "aria-describedby": `${path}-live-hint`, style: { ...actionStyle, opacity: 0.55, cursor: 'not-allowed' }, children: ["Edit live ", _jsx("span", { "aria-hidden": "true", children: "\u2197" })] }), _jsx("small", { id: `${path}-live-hint`, children: liveHint })] }), _jsx(PageComposerCanvas, { value: value, onChange: setValue, apiURL: config.routes.api, mode: "widget", height: height, readOnly: locked }), _jsx(FieldDescription, { path: path, description: field.admin?.description })] });
}
export const PageComposerField = withCondition(ComposerField);
function PresetTagField(props) {
    const { field, path: pathFromProps, readOnly, options = [] } = props;
    const { value, setValue, path, disabled, formProcessing } = useField({ potentiallyStalePath: pathFromProps });
    return _jsxs("div", { className: "field-type page-composer-preset-tag", style: { marginBottom: 24 }, children: [_jsx(FieldLabel, { htmlFor: path, label: field.label, required: field.required }), _jsx(FieldError, { path: path }), _jsxs("select", { id: path, value: value || '', disabled: Boolean(value || readOnly || disabled || formProcessing), onChange: event => setValue(event.target.value), children: [_jsx("option", { value: "", children: "Choose a component\u2026" }), value && !options.some(option => option.value === value) && _jsxs("option", { value: value, children: [value, " (unavailable)"] }), options.map(option => _jsx("option", { value: option.value, children: option.label }, option.value))] }), _jsx("small", { children: value ? 'The component type is fixed for this preset. Create a new preset to choose another type.' : 'Choose the component whose settings you want to save.' })] });
}
export const PageComposerPresetTagField = withCondition(PresetTagField);
function PresetField(props) {
    const { field, path: pathFromProps, readOnly } = props;
    const { config } = useConfig();
    const { value, setValue, path, disabled, formProcessing } = useField({ potentiallyStalePath: pathFromProps });
    const tagPath = path.includes('.') ? `${path.slice(0, path.lastIndexOf('.'))}.tag` : 'tag';
    const tag = useFormFields(([fields]) => fields[tagPath]?.value);
    const locked = Boolean(readOnly || disabled || formProcessing);
    return _jsxs("div", { className: "field-type page-composer-preset-field", style: { marginBottom: 24 }, children: [_jsx(FieldLabel, { htmlFor: path, label: field.label, required: field.required }), _jsx(FieldError, { path: path }), tag ? _jsx(PresetSettingsPanel, { tag: tag, value: value, onChange: setValue, apiURL: config.routes.api, readOnly: locked }, tag) : _jsx("p", { children: "Choose a component to edit its settings." }), _jsx(FieldDescription, { path: path, description: field.admin?.description })] });
}
export const PageComposerPresetField = withCondition(PresetField);
function PresetSettingsPanel({ tag, value, onChange, apiURL, readOnly }) {
    const surface = useRef(null);
    const controller = useRef(null);
    const definition = useRef(null);
    const latest = useRef({ value, onChange, readOnly });
    latest.current = { value, onChange, readOnly };
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let disposed = false;
        const abort = new AbortController();
        const root = document.createElement('div');
        surface.current.appendChild(root);
        let mounted;
        const timeout = window.setTimeout(() => abort.abort(), 20000);
        setReady(false);
        setError('');
        void (async () => {
            try {
                const response = await fetch(`${apiURL}/page-composer/config`, { credentials: 'same-origin', signal: abort.signal });
                const settings = await response.json();
                if (!response.ok)
                    throw new Error(settings.errors?.[0]?.message || 'Unable to load component settings.');
                const def = settings.catalog[tag];
                if (!def)
                    throw new Error(`Component “${tag}” is unavailable. Its saved settings and content have been preserved.`);
                const runtime = await loadRuntime(settings.base);
                if (disposed)
                    return;
                definition.current = def;
                const initial = presetValues(latest.current.value, def);
                if (!latest.current.value && !latest.current.readOnly)
                    latest.current.onChange(mergePresetValues(null, tag, def, initial));
                mounted = runtime.mountSettings(root, settings, {
                    tag, value: initial, readOnly: latest.current.readOnly,
                    onChange: values => {
                        if (!disposed && !latest.current.readOnly)
                            latest.current.onChange(mergePresetValues(latest.current.value, tag, def, values));
                    },
                    onError: message => { if (!disposed)
                        setError(message); },
                });
                controller.current = mounted;
                setReady(true);
            }
            catch (err) {
                if (!disposed)
                    setError(err instanceof Error ? err.message : 'Unable to load component settings.');
            }
            finally {
                window.clearTimeout(timeout);
            }
        })();
        return () => {
            disposed = true;
            abort.abort();
            window.clearTimeout(timeout);
            controller.current = null;
            definition.current = null;
            if (mounted)
                mounted.destroy();
            else
                root.remove();
        };
    }, [apiURL, tag]);
    useEffect(() => {
        if (definition.current)
            controller.current?.update({ value: presetValues(value, definition.current), readOnly });
    }, [value, readOnly]);
    return _jsxs(_Fragment, { children: [error && _jsx("div", { role: "alert", children: error }), !ready && !error && _jsx("div", { role: "status", children: "Loading component settings\u2026" }), _jsx("div", { ref: surface, className: "page-composer-surface", role: "region", "aria-label": "Component settings" })] });
}
/** Render only after a server-side admin authorization check. All writes still use Payload REST access controls. */
export function PageComposerLiveEditor(props) {
    // Next may retain a client component while navigating between documents.
    // Give each document/locale/field its own form state and dirty-state guard.
    const identity = JSON.stringify([props.collection, props.id, props.global, props.fieldPath, props.locale]);
    return _jsx(LiveEditorForm, { ...props }, identity);
}
function LiveEditorForm(props) {
    const { collection, id, global: globalSlug, fieldPath = 'content', apiURL = '/api', drafts = true, locale, exitURL, onSave } = props;
    const toolbar = useRef(null);
    useEffect(() => {
        const bar = toolbar.current;
        const section = bar.parentElement;
        const measure = () => section.style.setProperty('--payload-composer-toolbar-offset', `${bar.getBoundingClientRect().height}px`);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(bar);
        return () => { observer.disconnect(); section.style.removeProperty('--payload-composer-toolbar-offset'); };
    }, []);
    const [value, setValue] = useState(props.value);
    const [saved, setSaved] = useState(JSON.stringify(props.value));
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const dirty = JSON.stringify(value) !== saved;
    useEffect(() => {
        if (!dirty)
            return;
        const prevent = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', prevent);
        return () => window.removeEventListener('beforeunload', prevent);
    }, [dirty]);
    const save = async (publish) => {
        setBusy(true);
        setError('');
        setStatus('');
        try {
            if (onSave)
                await onSave(value, publish);
            else {
                const segments = fieldPath.split('.');
                if (segments.some(s => !/^[a-zA-Z_][\w-]*$/.test(s) || ['__proto__', 'constructor', 'prototype'].includes(s)))
                    throw new Error('Use onSave for array/block field paths.');
                const body = {};
                let target = body;
                segments.forEach((segment, i) => { if (i === segments.length - 1)
                    target[segment] = value;
                else {
                    target[segment] = {};
                    target = target[segment];
                } });
                if (drafts)
                    body._status = publish ? 'published' : 'draft';
                const endpoint = globalSlug ? `${apiURL}/globals/${encodeURIComponent(globalSlug)}` : `${apiURL}/${encodeURIComponent(collection || '')}/${encodeURIComponent(String(id || ''))}`;
                if (!globalSlug && (!collection || !id))
                    throw new Error('A collection and document ID, or a global slug, is required.');
                const query = new URLSearchParams({ ...(drafts && !publish ? { draft: 'true' } : {}), ...(locale ? { locale } : {}) });
                const response = await fetch(`${endpoint}?${query}`, { method: globalSlug ? 'POST' : 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const result = await response.json();
                if (!response.ok)
                    throw new Error(result.errors?.[0]?.message || 'Unable to save the document.');
            }
            setSaved(JSON.stringify(value));
            setStatus(drafts ? (publish ? 'Published.' : 'Draft saved.') : 'Saved.');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed.');
        }
        finally {
            setBusy(false);
        }
    };
    return _jsxs("section", { "aria-label": "Live content editor", children: [_jsxs("div", { ref: toolbar, style: { position: 'sticky', top: 0, zIndex: 110, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#141824', color: 'white', padding: 16, borderRadius: 8, marginBottom: 12 }, children: [_jsx("strong", { children: "Page Composer \u00B7 Live" }), _jsx("span", { children: dirty ? 'Unsaved changes' : 'All changes saved' }), _jsx("button", { type: "button", disabled: busy, onClick: () => save(false), children: drafts ? 'Save draft' : 'Save' }), drafts && _jsx("button", { type: "button", disabled: busy, onClick: () => save(true), children: "Publish" }), _jsx("a", { style: { color: 'white' }, href: exitURL, onClick: e => { if (dirty && !window.confirm('Leave without saving your changes?'))
                            e.preventDefault(); }, children: "Exit editing" }), _jsx("span", { role: "status", children: busy ? 'Saving…' : status }), error && _jsx("span", { role: "alert", children: error })] }), _jsx(PageComposerCanvas, { value: value, onChange: v => { setValue(v); setStatus(''); }, apiURL: apiURL, mode: "live", height: 850, readOnly: busy })] });
}
