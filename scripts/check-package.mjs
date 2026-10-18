import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }))
const paths = pack.files.map(file => file.path)
assert.ok(paths.includes('assets/pceditor_payloadcms.js'), 'Payload-specific compiled editor must be included')
assert.ok(!paths.some(path => /(^|\/)(editor-source|build\/js|node_modules)(\/|$)|\.map$|\.(tgz|zip)$/.test(path)), 'Core source, source maps and old archives must never ship')
const editor = readFileSync('assets/pceditor_payloadcms.js', 'utf8')
assert.ok(!editor.includes('webpack-dev-server') && !editor.includes('sourceMappingURL=data:'), 'Ship a production bundle without embedded source maps')
console.log(`Package audit passed: ${paths.length} files; compiled editor only, no editor source or source maps.`)
