import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { scopeEditorCSS } from './scope-css.mjs'
const editor = resolve(process.argv[2] || '../../editor')
await mkdir('assets', { recursive: true })
await cp(`${editor}/assets/js/pceditor_payloadcms.js`, 'assets/pceditor_payloadcms.js')
await cp(`${editor}/assets/js/pceditor_payloadcms.js.LICENSE.txt`, 'assets/pceditor_payloadcms.js.LICENSE.txt')
await writeFile('assets/editor.css', scopeEditorCSS(await readFile(`${editor}/assets/css/pceditor.css`, 'utf8')))
await cp(`${editor}/tinymce`, 'assets/tinymce', { recursive: true })
const pkg = JSON.parse(await readFile(`${editor}/package.json`, 'utf8'))
await writeFile('assets/editor-version.json', JSON.stringify({ version: pkg.version, react: pkg.dependencies.react }, null, 2) + '\n')
console.log('Copied the built editor, styles and self-hosted TinyMCE into the distributable package.')

// Remove artifacts left by older plugin packages. Never distribute core source.
await rm('editor-source', { recursive: true, force: true })
await rm('assets/editor.js', { force: true })
await rm('assets/editor.js.LICENSE.txt', { force: true })
