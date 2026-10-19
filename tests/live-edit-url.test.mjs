import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveLiveEditURL } from '../dist/live-edit-url.js'
import { pageComposerField, pageComposerPlugin } from '../dist/index.js'

test('frontend URLs encode saved document fields and support nested routes and context', () => {
  assert.equal(resolveLiveEditURL('/pages/{slug}?edit=1&locale={locale}&field={fieldPath}', {
    slug: 'News & updates/2026', locale: 'en', fieldPath: 'blocks.0.content',
  }), '/pages/News%20%26%20updates%2F2026?edit=1&locale=en&field=blocks.0.content')
  assert.equal(resolveLiveEditURL('https://site.example/{routing.slug}?id={id}', { routing: { slug: 'café' }, id: 0 }), 'https://site.example/caf%C3%A9?id=0')
  assert.equal(resolveLiveEditURL('/footer?edit=1', {}), '/footer?edit=1')
})

test('missing route values and unsafe URL schemes cannot create actionable editor links', () => {
  for (const template of [undefined, '', 'javascript:alert(1)', 'data:text/html,test', '//example.com/edit', '/\\example.com/edit', 'https://user:secret@example.com', '/pages/{slug}', '/pages/{bad token}', '/pages/\nfoo']) {
    assert.equal(resolveLiveEditURL(template, {}), undefined, String(template))
  }
  for (const slug of ['', null, undefined, {}, [], Infinity]) assert.equal(resolveLiveEditURL('/pages/{slug}', { slug }), undefined)
  assert.equal(resolveLiveEditURL('/pages/{slug}', Object.create({ slug: 'inherited' })), undefined)
})

test('Edit live configuration is reusable and does not enable Visual mode in admin fields', () => {
  const field = pageComposerField({ name: 'content', mode: 'live', liveEditURL: '/pages/{slug}?edit=1', admin: { readOnly: true } })
  assert.equal(field.liveEditURL, undefined, 'plugin option must not leak into Payload JSON field options')
  assert.equal(field.mode, undefined)
  assert.equal(field.admin.readOnly, true)
  assert.deepEqual(field.admin.components.Field.clientProps, { height: 640, liveEditURL: '/pages/{slug}?edit=1' })
  const config = pageComposerPlugin({ collections: { pages: { liveEditURL: '/pages/{slug}?edit=1' } }, globals: { footer: { liveEditURL: '/?edit=footer' } } })({
    collections: [{ slug: 'media', upload: true, fields: [] }, { slug: 'pages', fields: [] }], globals: [{ slug: 'footer', fields: [] }],
  })
  assert.equal(config.collections[1].fields[0].admin.components.Field.clientProps.liveEditURL, '/pages/{slug}?edit=1')
  assert.equal(config.globals[0].fields[0].admin.components.Field.clientProps.liveEditURL, '/?edit=footer')
  assert.equal(config.collections.find(c => c.slug === 'page-composer-templates').fields[1].admin.components.Field.clientProps.liveEditURL, undefined)
})
