import { test } from 'node:test'
import assert from 'node:assert/strict'
import { presetValues, mergePresetValues } from '../dist/presets.js'

const definition = { fields: [{ name: 'title', type: 'text' }, { name: 'level', type: 'select', value: 'h2' }] }
test('preset settings preserve unknown fields, field metadata and nested content', () => {
  const node = { fields: [{ name: 'title', type: 'text', value: 'Before', extra: 1 }, { name: 'custom', value: { keep: true } }], components: [{ name: 'Text' }], customMetadata: 'keep' }
  assert.deepEqual(presetValues(node, definition), { title: 'Before', level: 'h2' })
  const next = mergePresetValues(node, 'Title', definition, { title: 'After', level: 'h3' })
  assert.equal(next.fields[0].value, 'After')
  assert.equal(next.fields[0].extra, 1)
  assert.deepEqual(next.fields[1], node.fields[1])
  assert.deepEqual(next.components, node.components)
  assert.equal(next.customMetadata, 'keep')
  assert.equal(node.fields[0].value, 'Before', 'must not mutate the form value')
})
test('new and legacy presets receive catalog defaults', () => {
  const fresh = mergePresetValues(null, 'Title', definition, presetValues(null, definition))
  assert.equal(fresh.name, 'Title')
  assert.equal(fresh.fields.find(f => f.name === 'level').value, 'h2')
  const legacy = { title: 'Old', custom: 'Preserved' }
  const next = mergePresetValues(legacy, 'Title', definition, presetValues(legacy, definition))
  assert.equal(next.fields[0].value, 'Old')
  assert.equal(next.fields.find(f => f.name === 'custom').value, 'Preserved')
})
test('row layout changes retain fractional widths and rescue dropped columns content', () => {
  const node = { fields: [{ name: 'cols', value: '1/3+1/3+1/3' }], components: [
    { name: 'Col', col: '1/3', components: [{ name: 'Title' }], marker: 'a' },
    { name: 'Col', col: '1/3', components: [{ name: 'Image' }] },
    { name: 'Col', col: '1/3', components: [{ name: 'Text' }] },
  ] }
  const definition = { fields: [{ name: 'cols', type: 'cols' }] }
  const shrunk = mergePresetValues(node, 'Row', definition, { cols: '1/5+4/5' })
  assert.deepEqual(shrunk.components.map(c => c.col), ['1/5', '4/5'])
  assert.deepEqual(shrunk.components[1].components.map(c => c.name), ['Image', 'Text'])
  assert.equal(shrunk.components[0].marker, 'a')
  assert.equal(node.components.length, 3)
  const expanded = mergePresetValues(shrunk, 'Row', definition, { cols: '1/4+1/4+1/4+1/4' })
  assert.equal(expanded.components.length, 4)
  assert.deepEqual(expanded.components[1].components, shrunk.components[1].components)
  const unchanged = mergePresetValues(node, 'Row', definition, { cols: '' })
  assert.deepEqual(unchanged.components, node.components)
})
