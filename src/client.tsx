'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FieldDescription, FieldError, FieldLabel, useConfig, useDocumentInfo, useField, useFormFields, useFormModified, useLocale, withCondition } from '@payloadcms/ui'
import type { JSONFieldClientProps, TextFieldClientProps } from 'payload'
import { validateContent, type ComposerContent } from './content.js'
import { mergePresetValues, presetValues, type PresetNode, type ComponentDefinition } from './presets.js'
import { resolveLiveEditURL } from './live-edit-url.js'

type CanvasProps = {
  value: ComposerContent | null | undefined
  onChange: (value: ComposerContent) => void
  apiURL?: string
  mode?: 'widget' | 'live'
  readOnly?: boolean
  height?: number
  title?: string
}

type EditorController = { update: (state: { value: ComposerContent; mode: 'widget' | 'live'; readOnly: boolean }) => void; destroy: () => void }
type SettingsController = { update: (state: { value: Record<string, unknown>; readOnly: boolean }) => void; destroy: () => void }
type PresetSettings = { base: string; catalog: Record<string, ComponentDefinition> }
type RuntimeWindow = Window & {
  pcEditor?: unknown
  pce?: { payloadLicenseRequired?: boolean }
  PageComposerPayload?: {
    mountSettings: (root: HTMLElement, settings: PresetSettings, options: { tag: string; value: Record<string, unknown>; readOnly: boolean; onChange: (value: Record<string, unknown>) => void; onError: (message: string) => void }) => SettingsController
    mount: (root: HTMLElement, settings: unknown, options: { value: ComposerContent; mode: 'widget' | 'live'; readOnly: boolean; onChange: (value: ComposerContent) => void; onError: (error: string) => void }) => EditorController }
}

// Shared scripts/styles, independent editor roots. Keep the promises between
// route changes and concurrent field mounts; a failed load can be retried.
const resources = new Map<string, Promise<void>>()
function loadResource(url: string, stylesheet = false): Promise<void> {
  const existing = resources.get(url)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const node = document.createElement(stylesheet ? 'link' : 'script')
    if (node instanceof HTMLLinkElement) { node.rel = 'stylesheet'; node.href = url }
    else { node.src = url; node.async = true }
    const timeout = window.setTimeout(() => fail(), 20000)
    function fail() {
      window.clearTimeout(timeout); node.remove(); resources.delete(url)
      reject(new Error('Unable to load Page Composer. Check your connection and reload this page.'))
    }
    node.onload = () => { window.clearTimeout(timeout); resolve() }
    node.onerror = fail
    document.head.appendChild(node)
  })
  resources.set(url, promise)
  return promise
}
async function loadRuntime(base: string) {
  const runtime = window as RuntimeWindow
  await Promise.all(['editor.css', 'adapter.css', 'content.css'].map(file => loadResource(`${base}/assets/${file}?v=0.2.2`, true)))
  if (!runtime.pce?.payloadLicenseRequired) await loadResource(`${base}/assets/pceditor_payloadcms.js?v=0.2.2`)
  if (!runtime.PageComposerPayload) await loadResource(`${base}/assets/adapter.js?v=0.2.2`)
  return runtime.PageComposerPayload!
}

/** Dashboard notice; individual fields also show verification errors before mounting. */
export function PageComposerLicenseNotice() {
  const { config } = useConfig()
  const [message, setMessage] = useState('')
  useEffect(() => {
    const abort = new AbortController()
    void fetch(`${config.routes.api}/page-composer/license`, { credentials: 'same-origin', signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error('License check failed'); return response.json() })
      .then(result => setMessage(result.ok ? '' : result.message))
      .catch(() => { if (!abort.signal.aborted) setMessage('Unable to check the Page Composer license. Open an editor field to retry.') })
    return () => abort.abort()
  }, [config.routes.api])
  return message ? <div role="alert" style={{ margin: '16px 0', padding: 16, background: '#fff8e6', color: '#663c00', border: '1px solid #e5a126', borderRadius: 6 }}>
    <strong>Page Composer: </strong>{message} <a href="https://page-composer.com/account/downloads" target="_blank" rel="noreferrer">Manage license</a>
  </div> : null
}

export function PageComposerCanvas({ value, onChange, apiURL = '/api', mode = 'widget', readOnly = false, height = 640, title = 'Page Composer' }: CanvasProps) {
  const surface = useRef<HTMLDivElement>(null)
  const controller = useRef<EditorController | null>(null)
  const latest = useRef({ value, onChange, mode, readOnly })
  latest.current = { value, onChange, mode, readOnly }
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    const abort = new AbortController()
    // An imperative child lets the nested root finish unmounting after the host
    // commit without racing a Strict Mode remount into that same DOM element.
    const root = document.createElement('div')
    surface.current!.appendChild(root)
    let mounted: EditorController | undefined
    setReady(false); setError('')
    const timeout = window.setTimeout(() => abort.abort(), 20000)
    const start = async () => {
      try {
        const response = await fetch(`${apiURL}/page-composer/config`, { credentials: 'same-origin', signal: abort.signal })
        const settings = await response.json()
        if (!response.ok) throw new Error(settings.errors?.[0]?.message || 'Unable to load editor configuration.')
        const runtime = await loadRuntime(settings.base)
        if (disposed) return
        mounted = runtime.mount(root, settings, {
          value: latest.current.value ?? [], mode: latest.current.mode, readOnly: latest.current.readOnly,
          onChange: next => {
            if (disposed || latest.current.readOnly) return
            const validation = validateContent(next)
            if (validation === true) { setError(''); latest.current.onChange(next) }
            else setError(validation)
          },
          onError: message => { if (!disposed) setError(message) },
        })
        controller.current = mounted
        setReady(true)
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'Unable to load Page Composer.')
      } finally { window.clearTimeout(timeout) }
    }
    void start()
    return () => {
      disposed = true; abort.abort(); window.clearTimeout(timeout)
      controller.current = null
      if (mounted) mounted.destroy()
      else root.remove()
    }
  }, [apiURL])
  useEffect(() => { controller.current?.update({ value: value ?? [], mode, readOnly }) }, [value, mode, readOnly])
  return <div style={{ width: '100%' }}>
    <small>{readOnly ? 'Read-only content' : 'Changes are saved with the document. “Save template” stores a reusable layout.'}</small>
    {error && <div role="alert" style={{ padding: 12, color: '#b42318' }}>{error}</div>}
    {!ready && !error && <div role="status">Loading Page Composer…</div>}
    <div ref={surface} className="page-composer-surface" role="region" aria-label={title} style={{ minHeight: height }} />
  </div>
}

function ComposerField(props: JSONFieldClientProps & { height?: number; liveEditURL?: string }) {
  const { field, path: pathFromProps, readOnly, height, liveEditURL } = props
  const { config } = useConfig()
  const document = useDocumentInfo()
  const modified = useFormModified()
  const locale = useLocale()
  const { value, setValue, path, disabled, formProcessing, showError } = useField<ComposerContent>({
    potentiallyStalePath: pathFromProps,
    validate: (value, options) => props.validate
      ? props.validate(value, { ...options, name: field.name, type: 'json', required: field.required })
      : validateContent(value, field.required),
  })
  const locked = Boolean(readOnly || disabled || formProcessing || document.documentIsLocked || document.hasSavePermission === false)
  const saved = Boolean(document.globalSlug || document.id != null)
  const liveURL = resolveLiveEditURL(liveEditURL, {
    ...(document.data || document.initialData || {}),
    id: document.id, collection: document.collectionSlug, global: document.globalSlug,
    locale: locale?.code, fieldPath: path,
  })
  const liveHint = !saved ? 'Save this document before opening the frontend editor.'
    : locked ? 'Frontend editing is unavailable while this field is read-only or saving.'
    : modified ? 'Save your changes before opening the frontend editor.'
    : !liveURL ? 'Save the fields used by the frontend editing URL before opening it.'
    : 'Opens the frontend editor in a new tab using the saved content.'
  const canOpenLive = saved && !locked && !modified && Boolean(liveURL)
  const actionStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 4,
    border: '1px solid var(--theme-elevation-300)', background: 'var(--theme-elevation-50)',
    color: 'var(--theme-text)', textDecoration: 'none', font: 'inherit', fontWeight: 600,
  }
  return <div className={`field-type page-composer-field${showError ? ' error' : ''}`} style={{ marginBottom: 24 }}>
    <FieldLabel htmlFor={path} label={field.label} required={field.required} localized={field.localized} />
    <FieldError path={path} />
    {liveEditURL && <div className="page-composer-field-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: '8px 0 16px' }}>
      {canOpenLive
        ? <a href={liveURL} target="_blank" rel="noopener noreferrer" aria-describedby={`${path}-live-hint`} style={actionStyle}>Edit live <span aria-hidden="true">↗</span></a>
        : <button type="button" disabled aria-describedby={`${path}-live-hint`} style={{ ...actionStyle, opacity: 0.55, cursor: 'not-allowed' }}>Edit live <span aria-hidden="true">↗</span></button>}
      <small id={`${path}-live-hint`}>{liveHint}</small>
    </div>}
    <PageComposerCanvas value={value} onChange={setValue} apiURL={config.routes.api} mode="widget" height={height} readOnly={locked} />
    <FieldDescription path={path} description={field.admin?.description} />
  </div>
}

export const PageComposerField = withCondition(ComposerField)

type TagOption = { value: string; label: string }
function PresetTagField(props: TextFieldClientProps & { options?: TagOption[] }) {
  const { field, path: pathFromProps, readOnly, options = [] } = props
  const { value, setValue, path, disabled, formProcessing } = useField<string>({ potentiallyStalePath: pathFromProps })
  return <div className="field-type page-composer-preset-tag" style={{ marginBottom: 24 }}>
    <FieldLabel htmlFor={path} label={field.label} required={field.required} />
    <FieldError path={path} />
    <select id={path} value={value || ''} disabled={Boolean(value || readOnly || disabled || formProcessing)} onChange={event => setValue(event.target.value)}>
      <option value="">Choose a component…</option>
      {value && !options.some(option => option.value === value) && <option value={value}>{value} (unavailable)</option>}
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <small>{value ? 'The component type is fixed for this preset. Create a new preset to choose another type.' : 'Choose the component whose settings you want to save.'}</small>
  </div>
}
export const PageComposerPresetTagField = withCondition(PresetTagField)

function PresetField(props: JSONFieldClientProps) {
  const { field, path: pathFromProps, readOnly } = props
  const { config } = useConfig()
  const { value, setValue, path, disabled, formProcessing } = useField<PresetNode | null>({ potentiallyStalePath: pathFromProps })
  const tagPath = path.includes('.') ? `${path.slice(0, path.lastIndexOf('.'))}.tag` : 'tag'
  const tag = useFormFields(([fields]) => fields[tagPath]?.value) as string | undefined
  const locked = Boolean(readOnly || disabled || formProcessing)
  return <div className="field-type page-composer-preset-field" style={{ marginBottom: 24 }}>
    <FieldLabel htmlFor={path} label={field.label} required={field.required} />
    <FieldError path={path} />
    {tag ? <PresetSettingsPanel key={tag} tag={tag} value={value} onChange={setValue} apiURL={config.routes.api} readOnly={locked} /> : <p>Choose a component to edit its settings.</p>}
    <FieldDescription path={path} description={field.admin?.description} />
  </div>
}
export const PageComposerPresetField = withCondition(PresetField)

function PresetSettingsPanel({ tag, value, onChange, apiURL, readOnly }: {
  tag: string; value: PresetNode | null | undefined; onChange: (value: PresetNode) => void; apiURL: string; readOnly: boolean
}) {
  const surface = useRef<HTMLDivElement>(null)
  const controller = useRef<SettingsController | null>(null)
  const definition = useRef<ComponentDefinition | null>(null)
  const latest = useRef({ value, onChange, readOnly })
  latest.current = { value, onChange, readOnly }
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    const abort = new AbortController()
    const root = document.createElement('div')
    surface.current!.appendChild(root)
    let mounted: SettingsController | undefined
    const timeout = window.setTimeout(() => abort.abort(), 20000)
    setReady(false); setError('')
    void (async () => {
      try {
        const response = await fetch(`${apiURL}/page-composer/config`, { credentials: 'same-origin', signal: abort.signal })
        const settings = await response.json()
        if (!response.ok) throw new Error(settings.errors?.[0]?.message || 'Unable to load component settings.')
        const def: ComponentDefinition | undefined = settings.catalog[tag]
        if (!def) throw new Error(`Component “${tag}” is unavailable. Its saved settings and content have been preserved.`)
        const runtime = await loadRuntime(settings.base)
        if (disposed) return
        definition.current = def
        const initial = presetValues(latest.current.value, def)
        if (!latest.current.value && !latest.current.readOnly) latest.current.onChange(mergePresetValues(null, tag, def, initial))
        mounted = runtime.mountSettings(root, settings, {
          tag, value: initial, readOnly: latest.current.readOnly,
          onChange: values => {
            if (!disposed && !latest.current.readOnly) latest.current.onChange(mergePresetValues(latest.current.value, tag, def, values))
          },
          onError: message => { if (!disposed) setError(message) },
        })
        controller.current = mounted
        setReady(true)
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'Unable to load component settings.')
      } finally { window.clearTimeout(timeout) }
    })()
    return () => {
      disposed = true; abort.abort(); window.clearTimeout(timeout)
      controller.current = null; definition.current = null
      if (mounted) mounted.destroy()
      else root.remove()
    }
  }, [apiURL, tag])
  useEffect(() => {
    if (definition.current) controller.current?.update({ value: presetValues(value, definition.current), readOnly })
  }, [value, readOnly])
  return <>
    {error && <div role="alert">{error}</div>}
    {!ready && !error && <div role="status">Loading component settings…</div>}
    <div ref={surface} className="page-composer-surface" role="region" aria-label="Component settings" />
  </>
}

export type LiveEditorProps = {
  value: ComposerContent
  collection?: string
  id?: string | number
  global?: string
  fieldPath?: string
  apiURL?: string
  drafts?: boolean
  published?: boolean
  locale?: string
  exitURL: string
  /** Override saving for nested arrays/blocks or an application's own workflow. */
  onSave?: (value: ComposerContent, publish: boolean) => Promise<void>
}

/** Render only after a server-side admin authorization check. All writes still use Payload REST access controls. */
export function PageComposerLiveEditor(props: LiveEditorProps) {
  // Next may retain a client component while navigating between documents.
  // Give each document/locale/field its own form state and dirty-state guard.
  const identity = JSON.stringify([props.collection, props.id, props.global, props.fieldPath, props.locale])
  return <LiveEditorForm key={identity} {...props} />
}

function LiveEditorForm(props: LiveEditorProps) {
  const { collection, id, global: globalSlug, fieldPath = 'content', apiURL = '/api', drafts = true, locale, exitURL, onSave } = props
  const toolbar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = toolbar.current!
    const section = bar.parentElement!
    const measure = () => section.style.setProperty('--payload-composer-toolbar-offset', `${bar.getBoundingClientRect().height}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => { observer.disconnect(); section.style.removeProperty('--payload-composer-toolbar-offset') }
  }, [])
  const [value, setValue] = useState(props.value)
  const [saved, setSaved] = useState(JSON.stringify(props.value))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const dirty = JSON.stringify(value) !== saved
  useEffect(() => {
    if (!dirty) return
    const prevent = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [dirty])
  const save = async (publish: boolean) => {
    setBusy(true); setError(''); setStatus('')
    try {
      if (onSave) await onSave(value, publish)
      else {
        const segments = fieldPath.split('.')
        if (segments.some(s => !/^[a-zA-Z_][\w-]*$/.test(s) || ['__proto__', 'constructor', 'prototype'].includes(s))) throw new Error('Use onSave for array/block field paths.')
        const body: Record<string, unknown> = {}
        let target = body
        segments.forEach((segment, i) => { if (i === segments.length - 1) target[segment] = value; else { target[segment] = {}; target = target[segment] as Record<string, unknown> } })
        if (drafts) body._status = publish ? 'published' : 'draft'
        const endpoint = globalSlug ? `${apiURL}/globals/${encodeURIComponent(globalSlug)}` : `${apiURL}/${encodeURIComponent(collection || '')}/${encodeURIComponent(String(id || ''))}`
        if (!globalSlug && (!collection || !id)) throw new Error('A collection and document ID, or a global slug, is required.')
        const query = new URLSearchParams({ ...(drafts && !publish ? { draft: 'true' } : {}), ...(locale ? { locale } : {}) })
        const response = await fetch(`${endpoint}?${query}`, { method: globalSlug ? 'POST' : 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.errors?.[0]?.message || 'Unable to save the document.')
      }
      setSaved(JSON.stringify(value)); setStatus(drafts ? (publish ? 'Published.' : 'Draft saved.') : 'Saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Live content editor">
    <div ref={toolbar} style={{ position: 'sticky', top: 0, zIndex: 110, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#141824', color: 'white', padding: 16, borderRadius: 8, marginBottom: 12 }}>
      <strong>Page Composer · Live</strong><span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
      <button type="button" disabled={busy} onClick={() => save(false)}>{drafts ? 'Save draft' : 'Save'}</button>
      {drafts && <button type="button" disabled={busy} onClick={() => save(true)}>Publish</button>}
      <a style={{ color: 'white' }} href={exitURL} onClick={e => { if (dirty && !window.confirm('Leave without saving your changes?')) e.preventDefault() }}>Exit editing</a>
      <span role="status">{busy ? 'Saving…' : status}</span>
      {error && <span role="alert">{error}</span>}
    </div>
    <PageComposerCanvas value={value} onChange={v => { setValue(v); setStatus('') }} apiURL={apiURL} mode="live" height={850} readOnly={busy} />
  </section>
}
