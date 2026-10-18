import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pageComposerField, pageComposerPlugin, validateContent } from '../dist/index.js'
import { renderContent, renderLiveComponent } from '../dist/render.js'
import { stringify } from 'flatted'

test('field factory preserves field options and works inside nested configs', () => {
  const field = pageComposerField({ name: 'body', required: true, localized: true, admin: { description: 'Body', readOnly: true } })
  assert.equal(field.type, 'json')
  assert.equal(field.localized, true)
  assert.equal(field.admin.readOnly, true)
  assert.match(field.admin.components.Field.path, /client#PageComposerField/)
  assert.equal(field.validate([]), 'Add at least one content component.')
})
test('plugin appends configured content without clobbering existing fields, endpoints or globals', () => {
  const base = { collections: [{ slug: 'media', upload: true, fields: [] }, { slug: 'articles', fields: [{ name: 'title', type: 'text' }] }], globals: [{ slug: 'footer', fields: [] }], endpoints: [{ path: '/health', method: 'get', handler: () => new Response('ok') }] }
  const config = pageComposerPlugin({ collections: { articles: {} }, globals: { footer: { name: 'body' } } })(base)
  assert.equal(config.collections[1].fields[0].name, 'title')
  assert.equal(config.collections[1].fields[1].name, 'content')
  assert.equal(config.globals[0].fields[0].name, 'body')
  assert.equal(config.endpoints[0].path, '/health')
  assert.equal(base.collections.length, 2)
  assert.throws(() => pageComposerPlugin({ collections: { articles: { name: 'title' } } })(base), /already exists/)
})
test('validation rejects malformed and overly deep trees, accepts Mongo IDs and nested values', () => {
  assert.notEqual(validateContent({}), true)
  assert.notEqual(validateContent([{ name: 'Text', components: {} }]), true)
  assert.equal(validateContent([{ name: 'Image', fields: [{ name: 'image', value: { file_id: '507f1f77bcf86cd799439011', file_path: '/api/media/file/a.png' } }] }]), true)
  let nodes = []
  for (let i = 0; i < 35; i++) nodes = [{ name: 'Container', components: nodes }]
  assert.notEqual(validateContent(nodes), true)
})
test('public renderer escapes text and sanitizes rich text, links and CSS', () => {
  const html = renderContent([
    { name: 'Title', fields: [{ name: 'title', value: '<img src=x onerror=alert(1)>' }] },
    { name: 'Text', fields: [{ name: 'text', value: '<p>Hello <strong>world</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>' }] },
    { name: 'Button', fields: [{ name: 'url', value: 'javascript:alert(1)' }] },
    { name: 'Container', fields: [{ name: 'css_props', value: { desktop: { css: { color: 'red', background: 'url(javascript:alert(1))' } }, mobile: { css: { padding: '8px' } } } }] },
  ])
  assert.match(html, /Hello <strong>world<\/strong>/)
  assert.match(html, /&lt;img/)
  assert.doesNotMatch(html, /<script|<img[^>]*onerror|javascript:|background:url/)
  assert.match(html, /@media\(max-width:640px\).*padding:8px/)
})
test('renderer preserves nested columns and live flatted fields, with slots for sections', () => {
  const html = renderContent([{ name: 'Row', components: [{ name: 'Col', col: '6/12', components: [{ name: 'Title', fields: [{ name: 'title', value: 'Nested' }] }] }] }])
  assert.match(html, /--pc-width:50%/)
  assert.match(html, /Nested/)
  const live = renderLiveComponent({ name: 'Image', fields: [{ name: 'image', value: stringify({ file_path: '/api/media/file/a.png', alt: 'Photo' }) }] })
  assert.match(live.html, /src="\/api\/media\/file\/a.png"/)
  const sections = renderLiveComponent({ name: 'Accordion', fields: [], children: [{ name: 'Col', value: { name: 'First' } }, { name: 'Col', value: { name: 'Second' } }] })
  assert.equal(sections.html.match(/data-components/g).length, 2)
  assert.match(sections.html, /data-live-add-section/)
})

test('presets register settings fields and component choices from the merged catalog', () => {
  const config = pageComposerPlugin({ presetsCollection: 'saved-components', components: { Custom: { label: 'My component', fields: [] } } })({ collections: [{ slug: 'media', fields: [] }] })
  const fields = config.collections.find(c => c.slug === 'saved-components').fields
  assert.equal(fields.find(f => f.name === 'tag').type, 'text', 'preserve existing tags and API shape')
  const tag = fields.find(f => f.name === 'tag').admin.components.Field
  assert.match(tag.path, /#PageComposerPresetTagField$/)
  assert.ok(tag.clientProps.options.some(o => o.value === 'Custom' && o.label === 'My component'))
  assert.match(fields.find(f => f.name === 'data').admin.components.Field, /#PageComposerPresetField$/)
})
