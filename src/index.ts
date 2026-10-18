import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Access, CollectionConfig, Config, JSONField, PayloadRequest, Plugin } from 'payload'
import { createLicenseVerifier } from './license.js'
import { createCatalog } from './catalog.js'
import { validateContent } from './content.js'
import { contentCSS, renderLiveComponent, type Renderers } from './render.js'

export { validateContent } from './content.js'
export type { ComposerContent, ComposerNode } from './content.js'
export type { Renderers, ComponentRenderer } from './render.js'

export type PageComposerFieldOptions = Omit<JSONField, 'type'> & { mode?: 'widget' | 'live'; height?: number }

/** Add to any collection, global, group, tab, array or block's fields. */
export function pageComposerField(options: PageComposerFieldOptions): JSONField {
  const { mode = 'widget', height = 640, ...field } = options
  return {
    ...field,
    type: 'json',
    defaultValue: field.defaultValue ?? [],
    validate: (value, args) => {
      const valid = validateContent(value, field.required)
      return valid !== true ? valid : field.validate ? field.validate(value, args) : true
    },
    admin: {
      ...field.admin,
      components: {
        ...field.admin?.components,
        Field: { path: '@page-composer/payload/client#PageComposerField', clientProps: { mode, height } },
      },
    },
  }
}

export type PageComposerPluginOptions = {
  /** Purchased Payload CMS product key. Keep it in a server-only environment variable. */
  apiKey?: string
  /** Override only for a development licensing backend. */
  licenseVerifyURL?: string
  mediaCollection?: string
  templatesCollection?: string
  presetsCollection?: string
  /** Defaults to authenticated users of config.admin.user. */
  access?: Access
  /** Merge extra component definitions into the default catalog. */
  components?: Record<string, Record<string, unknown>>
  renderers?: Renderers
  /** Add a content field to selected collections without modifying their definitions. */
  collections?: Record<string, false | Omit<PageComposerFieldOptions, 'name'> & { name?: string }>
  globals?: Record<string, false | Omit<PageComposerFieldOptions, 'name'> & { name?: string }>
}

// Resolve at runtime: bundlers treat new URL('../assets/', import.meta.url) as
// a module import, and externalizing the whole package breaks client CSS imports.
const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'))
const assetsDirectory = path.resolve(path.dirname(nodeRequire.resolve('@page-composer/payload')), '../assets')
const jsonError = (message: string, status: number) => Response.json({ errors: [{ message }] }, { status })

export function pageComposerPlugin(options: PageComposerPluginOptions = {}): Plugin {
  return (config: Config): Config => {
    const verifyLicense = createLicenseVerifier({ apiKey: options.apiKey, verifyURL: options.licenseVerifyURL })
    const licenseFor = (req: PayloadRequest) => verifyLicense(req.headers.get('host') || (req.url ? new URL(req.url).hostname : ''))
    const media = options.mediaCollection || 'media'
    const templates = options.templatesCollection || 'page-composer-templates'
    const presets = options.presetsCollection || 'page-composer-presets'
    const access: Access = options.access || (({ req }) => Boolean(req.user && req.user.collection === (req.payload.config.admin.user || 'users')))
    const allow = async (req: PayloadRequest) => Boolean(req.user) && (await access({ req })) === true
    const apiURL = config.routes?.api || '/api'
    const base = `${apiURL}/page-composer`
    const catalog = { ...createCatalog(`${base}/assets`), ...options.components }
    const sharedAccess = { read: access, create: access, update: access, delete: access }
    const shared: CollectionConfig[] = [
      {
        slug: templates, labels: { singular: 'Composer template', plural: 'Composer templates' },
        admin: { group: 'Page Composer', useAsTitle: 'name' }, access: sharedAccess,
        fields: [{ name: 'name', type: 'text', required: true }, pageComposerField({ name: 'content' })],
      },
      {
        slug: presets, labels: { singular: 'Component preset', plural: 'Component presets' },
        admin: { group: 'Page Composer', useAsTitle: 'name' }, access: sharedAccess,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'tag', label: 'Component', type: 'text', required: true, admin: {
            components: { Field: { path: '@page-composer/payload/client#PageComposerPresetTagField', clientProps: {
              options: Object.entries(catalog).map(([value, def]) => ({ value, label: typeof def.label === 'string' ? def.label : value })),
            } } },
          } },
          { name: 'data', label: 'Component settings', type: 'json', required: true, admin: {
            description: 'Changes are saved with this preset. Nested content is preserved.',
            components: { Field: '@page-composer/payload/client#PageComposerPresetField' },
          } },
        ],
      },
    ]
    let collections = [...(config.collections || [])]
    if (!collections.some(c => c.slug === media)) throw new Error(`Page Composer: upload collection "${media}" is missing.`)
    for (const collection of shared) {
      if (collections.some(c => c.slug === collection.slug)) throw new Error(`Page Composer: collection "${collection.slug}" already exists. Configure a different slug.`)
      collections.push(collection)
    }
    const append = (fields: CollectionConfig['fields'], setting: Omit<PageComposerFieldOptions, 'name'> & { name?: string }) => {
      const name = setting.name || 'content'
      if (fields.some(f => 'name' in f && f.name === name)) throw new Error(`Page Composer: field "${name}" already exists. Use pageComposerField() explicitly; existing content is never converted automatically.`)
      return [...fields, pageComposerField({ ...setting, name })]
    }
    collections = collections.map(c => {
      const setting = options.collections?.[c.slug]
      return setting ? { ...c, fields: append(c.fields, setting) } : c
    })
    return {
      ...config,
      collections,
      admin: {
        ...config.admin,
        components: {
          ...config.admin?.components,
          beforeDashboard: [...(config.admin?.components?.beforeDashboard || []), '@page-composer/payload/client#PageComposerLicenseNotice'],
        },
      },
      globals: (config.globals || []).map(g => {
        const setting = options.globals?.[g.slug]
        return setting ? { ...g, fields: append(g.fields, setting) } : g
      }),
      endpoints: [
        ...(config.endpoints || []),
        {
          path: '/page-composer/license', method: 'get', handler: async req => {
            if (!await allow(req)) return jsonError('Sign in to check the Page Composer license.', 401)
            return Response.json(await licenseFor(req), { headers: { 'Cache-Control': 'private, no-store' } })
          },
        },
        {
          path: '/page-composer/config', method: 'get', handler: async req => {
            if (!await allow(req)) return jsonError('Sign in to the admin panel to use Page Composer.', 401)
            const license = await licenseFor(req)
            if (!license.ok) return jsonError(license.message, 403)
            return Response.json({ base, apiURL, media, templates, presets, catalog, licenseToken: license.token }, {
              headers: { 'Cache-Control': 'private, no-store' },
            })
          },
        },
        {
          path: '/page-composer/assets/:asset*', method: 'get', handler: async req => {
            const param = req.routeParams?.asset
            const relative = Array.isArray(param) ? param.join('/') : String(param || '')
            if (!relative || relative.endsWith('.map') || relative.split('/').some(part => part === '..' || part.startsWith('.')) || relative.includes('\\')) return jsonError('Invalid asset path.', 400)
            const filename = path.resolve(assetsDirectory, relative)
            if (!filename.startsWith(assetsDirectory + path.sep)) return jsonError('Invalid asset path.', 400)
            const mime: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json' }
            try {
              const data = relative === 'content.css' ? Buffer.from(contentCSS) : await readFile(filename)
              return new Response(new Uint8Array(data), { headers: { 'Content-Type': mime[path.extname(relative)] || 'application/octet-stream', 'Cache-Control': 'public, no-cache', 'X-Content-Type-Options': 'nosniff' } })
            } catch { return jsonError('Asset not found.', 404) }
          },
        },
        {
          path: '/page-composer/render', method: 'post', handler: async req => {
            if (!await allow(req)) return jsonError('Not authorized.', 401)
            const license = await licenseFor(req)
            if (!license.ok) return jsonError(license.message, 403)
            const raw = await req.text!()
            if (raw.length > 2_000_000) return jsonError('Content exceeds the 2 MB limit.', 413)
            try {
              const args = JSON.parse(raw)
              if (!args || typeof args.name !== 'string' || !Array.isArray(args.fields)) return jsonError('Invalid component.', 400)
              return Response.json(renderLiveComponent(args, options.renderers), { headers: { 'Cache-Control': 'no-store' } })
            } catch { return jsonError('Unable to render this component.', 400) }
          },
        },
      ],
    }
  }
}
