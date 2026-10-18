import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { scopeEditorCSS } from '../scripts/scope-css.mjs'

function fixture(source) {
  const frames = [], microtasks = [], mounts = [], drivers = []
  const window = {
    pce: { React: { Component: class {}, createElement() {} }, register: { driver: d => drivers.push(d), field() {} }, langs: { en: {} } },
    pcEditorSettingsFields(root, config, values) {
      const handle = { destroyed: false, destroy() { this.destroyed = true } }
      mounts.push({ root, config, values, handle })
      return handle
    },
    pcEditor(root, config) {
      const handle = { destroyed: false, destroy() { this.destroyed = true } }
      mounts.push({ root, config, handle })
      return handle
    },
  }
  vm.runInNewContext(source, { window, requestAnimationFrame: cb => frames.push(cb), queueMicrotask: cb => microtasks.push(cb), URLSearchParams, FormData, fetch: async url => ({ ok: true, json: async () => ({ url, docs: [] }) }) })
  function root() {
    const listeners = new Map(), classes = new Set()
    const surface = { inert: false, classList: { toggle: (k, v) => v ? classes.add(k) : classes.delete(k), remove: k => classes.delete(k) }, addEventListener: (k, cb) => listeners.set(k, cb), removeEventListener: k => listeners.delete(k), contains: () => true }
    return { parentElement: surface, setAttribute() {}, remove() { this.removed = true }, listeners }
  }
  const flush = () => { while (frames.length) frames.shift()(); while (microtasks.length) microtasks.shift()() }
  return { runtime: window.PageComposerPayload, root, mounts, flush }
}
const source = await readFile(new URL('../assets/adapter.js', import.meta.url), 'utf8')

test('direct adapters isolate fields, honor locks and external resets, and dispose roots', async () => {
  const { runtime, root, mounts, flush } = fixture(source)
  const a = root(), b = root(), changesA = [], changesB = []
  const settings = { base: '/api/page-composer', apiURL: '/api', media: 'media', catalog: {} }
  const opts = changes => ({ value: [], mode: 'widget', onChange: value => changes.push(value), onError: message => assert.fail(message) })
  const first = runtime.mount(a, settings, opts(changesA))
  const second = runtime.mount(b, { ...settings, media: 'other-media' }, opts(changesB))
  assert.notEqual(a.id, b.id)
  flush()
  const change = (root, id, value) => root.listeners.get('change')({ target: { dataset: { pceEditor: id }, value: JSON.stringify(value) } })
  const edited = [{ name: 'Title' }]
  change(a, b.id, edited)
  assert.equal(changesA.length, 0)
  change(a, a.id, edited)
  assert.equal(changesA.length, 1)
  assert.equal(changesB.length, 0)
  first.update({ value: edited, mode: 'widget', readOnly: true })
  assert.equal(mounts.length, 2, 'echo and readOnly changes must not remount')
  assert.equal(a.parentElement.inert, true)
  assert.equal(b.parentElement.inert, false)
  change(a, a.id, [])
  assert.equal(changesA.length, 1)
  await assert.rejects(mounts[0].config.requests.config.driver.saveTemplate({}), /read-only/)
  assert.match((await mounts[1].config.requests.config.driver.requestMedia('limit=1')).url, /other-media/)
  first.update({ value: [], mode: 'widget', readOnly: false })
  assert.equal(mounts.length, 3)
  assert.equal(mounts[0].handle.destroyed, true)
  first.destroy(); first.destroy(); flush()
  assert.equal(a.listeners.size, 0)
  assert.equal(mounts[2].handle.destroyed, true)
  assert.equal(a.removed, true)
  assert.equal(mounts[1].handle.destroyed, false)
  second.destroy(); flush()
})

test('editor controls prevent default form submission without blocking their click handlers', () => {
  const { runtime, root, flush } = fixture(source)
  const a = root()
  const controller = runtime.mount(a, {}, { value: [], mode: 'widget', onChange() {}, onError: assert.fail })
  let prevented = 0
  a.listeners.get('click')({ target: { closest: () => ({ type: 'submit' }) }, preventDefault: () => prevented++ })
  a.listeners.get('keydown')({ key: 'Enter', target: { matches: () => true }, preventDefault: () => prevented++ })
  assert.equal(prevented, 2)
  controller.destroy(); flush()
})

test('stylesheet scopes general rules and drag state without altering keyframes or body portals', () => {
  const css = scopeEditorCSS(':root{--pce-test:1}[role="button"],.menu-element{color:red}body.pce-sec-dragging *{cursor:grabbing}@keyframes spin{0%{opacity:0}to{opacity:1}}.swal2-container{z-index:10}')
  assert.match(css, /\.page-composer-surface\{--pce-test/)
  assert.match(css, /\.page-composer-surface \[role="button"\]/)
  assert.match(css, /body\.pce-sec-dragging \.page-composer-surface \*/)
  assert.match(css, /@keyframes spin\{0%/)
  assert.match(css, /\.swal2-container:has\(\.pce-swal\)/)
})


test('preset settings notify once, retain the root on echoes, enforce locks and clean up', () => {
  const { runtime, root, mounts, flush } = fixture(source)
  const a = root(), changes = []
  const controller = runtime.mountSettings(a, { catalog: { Title: { fields: [{ name: 'title', type: 'text' }] } } }, {
    tag: 'Title', value: { title: 'Before' }, onChange: value => changes.push(value), onError: assert.fail,
  })
  mounts[0].config.onChange({ title: 'After' })
  assert.equal(changes.length, 1)
  controller.update({ value: { title: 'After' }, readOnly: true })
  assert.equal(mounts.length, 1)
  assert.equal(a.parentElement.inert, true)
  mounts[0].config.onChange({ title: 'Blocked' })
  assert.equal(changes.length, 1)
  controller.update({ value: { title: 'Reset' }, readOnly: false })
  assert.equal(mounts.length, 2)
  assert.equal(mounts[0].handle.destroyed, true)
  controller.destroy(); controller.destroy(); flush()
  assert.equal(mounts[1].handle.destroyed, true)
  assert.equal(a.listeners.size, 0)
  assert.equal(a.removed, true)
  mounts[1].config.onChange({ title: 'Disposed' })
  assert.equal(changes.length, 1)
})
