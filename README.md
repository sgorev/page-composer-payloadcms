# Page Composer for Payload

An installable Payload 3 plugin with a reusable visual content field, Widget editing in the admin, an authenticated Live editor for application frontends, a shared HTML renderer, media uploads/library selection, reusable templates and component presets.

Version 0.2.2. Tested with Payload 3.91.0, Next 16.3.3, MongoDB and React 19.2.6 in Payload; the embedded editor uses its own React 19.3.1 bundle. Requires Node 22.12 or later. The editor mounts directly into the host page using an independent React root, with scoped styles and per-field state. There is no editor iframe or nested canvas scrollbar; the canvas grows with its content. The core's full-window control remains available in Widget mode. The editor assets are self-hosted. The Page Composer plugin API key is verified against the Page Composer licensing service. Payload CMS itself is free to use.

## Install

Install the release tarball in a Payload application:

```sh
npm install ./page-composer-payload-0.2.2.tgz
```

You can also install from [GitHub](https://github.com/sgorev/page-composer-payloadcms):

```sh
npm install github:sgorev/page-composer-payloadcms#main
```

Or clone the repository to work on the integration:

```sh
git clone https://github.com/sgorev/page-composer-payloadcms.git
cd page-composer-payloadcms
npm ci
```

The repository includes the compiled editor bundle and integration code. The package's `prepare` script builds the TypeScript entry points. Both download options require a purchase of the Page Composer plugin for Payload CMS and a Page Composer plugin API key to run the editor.

## License

The Payload integration is licensed under the [MIT License](LICENSE). The bundled Page Composer editor remains commercial software under [EDITOR-LICENSE.txt](EDITOR-LICENSE.txt); its proprietary source is not included. Third-party components retain their own licenses, listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

After publishing to npm, the registry install command will be `npm install @page-composer/payload`. Marketplace submission is a separate listing/review step; no marketplace listing is created by installing the package.

## Configure Payload

```ts
import { pageComposerPlugin, pageComposerField } from '@page-composer/payload'

export default buildConfig({
  // ...db, secret, admin, etc.
  collections: [
    Media, // an existing upload collection, slug "media"
    {
      slug: 'pages',
      versions: { drafts: true },
      fields: [
        { name: 'title', type: 'text', required: true },
        pageComposerField({ name: 'content', label: 'Content' }),
      ],
    },
  ],
  plugins: [pageComposerPlugin({ mediaCollection: 'media', apiKey: process.env.PAGE_COMPOSER_API_KEY })],
})
```

`pageComposerField()` returns a native Payload **JSON field with a custom admin Field component**. It accepts JSON-field settings such as `required`, `localized`, `access`, `hooks`, and `admin.condition`/`admin.readOnly`. The field can be placed in any collection, global, group, tab, array, or block. Use different names to place several editors in one document. Admin fields always use Widget mode; `height` defaults to 640 px. Visual editing is available on the frontend through `PageComposerLiveEditor`. The legacy field `mode` option is deprecated and ignored.

To show an **Edit live** button beside an admin field, configure the frontend route:

```ts
pageComposerField({
  name: 'content',
  liveEditURL: '/pages/{slug}?edit=1',
})
```

The button opens a new tab. It is unavailable for unsaved documents, pending form changes, read-only fields and locked documents. Save changes first; the frontend opens the saved document, not the current admin form. The normal Widget editor remains in the admin; there is no admin mode switch.

URL placeholders use saved document values (including nested paths such as `{routing.slug}`) and are URL-encoded. `{id}`, `{collection}`, `{global}`, `{locale}` and `{fieldPath}` are also available. Use `{locale}` only when localization is enabled. Absolute HTTP(S) URLs are supported for separate frontends; authentication there must be configured by the host application. Without `liveEditURL`, no button is added. This option also works with the plugin's `collections` and `globals` field settings.

The URL must point to an existing authorized frontend editor route, as shown under **Public rendering and frontend Live editing** below. The plugin does not infer routes from Payload's Live Preview configuration: previewing and editing are separate actions. Frontend authorization and Payload's save permissions still apply.

You can alternatively append fields through plugin options:

```ts
pageComposerPlugin({
  collections: { pages: {}, products: { name: 'description', label: 'Description' } },
  globals: { footer: { name: 'content' } },
})
```

The plugin refuses to overwrite an existing field. Existing Lexical, HTML or third-party block content requires an explicit migration; it is not silently converted.

The plugin adds `page-composer-templates` and `page-composer-presets` collections. Their slugs can be changed through `templatesCollection` and `presetsCollection`. Configure these slugs once before creating records. All editors in an application share this library.

Component presets use `pcEditorSettingsFields` directly in the admin: choose a component when creating a preset, edit its Content/Layout/Style tabs, then use Payload's **Save** button. The component type stays fixed after selection, matching WordPress Pro. Existing presets open with their saved settings. Media fields use the Payload library and uploads; rich text uses the bundled TinyMCE.

The settings bridge preserves nested content, field metadata and unknown fields. Row layout changes keep fractional widths and move children from removed columns into the last remaining column. An unavailable component displays a message while preserving its stored data. The panel participates in Payload dirty state and read-only handling, and releases its editor root on navigation. The bundled standalone settings API adds optional `onChange(values)` and `destroy()` hooks for this lifecycle.

Then run:

```sh
npx payload generate:importmap
npx payload generate:types
```

For Next standalone/serverless deployments, include the package's static assets in output tracing:

```ts
const nextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./node_modules/@page-composer/payload/assets/**/*'],
  },
}
export default withPayload(nextConfig)
```

Do not put the entire package in `serverExternalPackages`: the `/client` entry must be bundled by Next to process Payload UI and its styles. The normal Node runtime is required; the plugin is not an Edge runtime package. The application must run with its package.json at `process.cwd()` (the standard Next launch directory).

## License configuration

Buy **Payload CMS Plugin** on the Page Composer website and bind a main domain and, optionally, one technical domain under Account > Downloads. The main domain is bind-once for customers. Customers can change or remove the technical domain; website admins can update either domain under Admin > Keys. Default price is $99, configurable under Admin > Pricing.

Set `PAGE_COMPOSER_API_KEY` in your server environment and pass it as `apiKey` to `pageComposerPlugin`. Never use a `NEXT_PUBLIC_` variable for this key. WordPress licenses and account/editor keys do not unlock Payload. Missing, blocked, unbound or mismatched keys show an admin notification and prevent Widget, Live and preset-settings editors from mounting. Published content remains readable.

The server verifies an Ed25519-signed decision and sends only that token to the browser. The dedicated bundle independently checks its signature, product, expiry and actual browser hostname. Verified decisions are cached for up to ten minutes per key/domain; moving the site to another domain triggers a new check immediately. Verification errors fail closed, with a retry message; an unexpired verified decision may be reused until expiry. Domain updates/revocation take effect on the next check, within the cache lifetime. An already-open editor is checked again when remounted/reloaded.

For local development only, `licenseVerifyURL` can point to your website backend's `/verify-plugin`. Its Ed25519 key must match the public verification key embedded in the plugin and editor. Only public keys belong in source control; the website's signing secret stays in its environment.

## Public rendering and frontend Live editing

```tsx
import { PageComposerContent } from '@page-composer/payload/render'
import { PageComposerLiveEditor } from '@page-composer/payload/client'
import type { ComposerContent } from '@page-composer/payload'

// In a SERVER page, authenticate with payload.auth({ headers: await headers() }).
// Load the document with overrideAccess:false and the authenticated user.
// Read drafts ONLY for an authorized edit request; public requests load published content.
const canEdit = Boolean(user && user.collection === 'users')

return canEdit && editRequested
  ? <PageComposerLiveEditor
      value={document.content as ComposerContent}
      collection="pages"
      id={document.id}
      fieldPath="content"
      drafts
      exitURL={`/pages/${document.slug}`}
    />
  : <PageComposerContent value={document.content as ComposerContent} id={`page-${document.id}`} />
```

The host page provides its header/footer around the content canvas. Live mode renders the content itself, with component controls and styling directly in the page DOM. It does not automatically make arbitrary surrounding website HTML editable.

`PageComposerLiveEditor` supports `global="footer"`, `apiURL`, `locale`, and `drafts={false}`. Normal top-level and group field paths can be saved directly. For fields inside arrays/blocks, supply `onSave(value, publish)` and update the correct row through your application workflow, preserving siblings and row IDs. The admin field handles nested paths automatically through Payload's field context.

The host must authorize showing Live mode; hiding the button alone is not authorization. Saving uses Payload REST with the current session, so collection/global/field access checks remain authoritative. The plugin's `access` option controls its configuration endpoint, renderer, templates and presets; by default it allows users from `config.admin.user`. It must return a boolean for editor endpoint access. Application document permissions are separate.

Use Payload's Save Draft/Publish controls for the admin document. The editor's **Save template** action saves a reusable layout, not the current document. Frontend Live mode has explicit Save draft / Publish / Exit controls and an unsaved-changes warning. Concurrent document editing has Payload's normal behavior; this is not a collaborative editor or an extra locking system.

## Content and extensions

Stored content is a Page Composer component array, not HTML. The same array is used by Widget, Live, drafts and versions. Supported initial components: Row, Col, Container, Heading, Rich text, Image, Button, Spacer, Accordion and Tabs. Desktop/tablet/mobile style fields share the server renderer. Media uses Payload IDs and upload URLs. Uploads supply an `alt` field; adapt `assets/adapter.js` if your upload collection requires additional metadata. Files stay in the host application's configured upload storage. Existing media URLs in content are snapshots; changing asset URLs requires a content migration or a custom renderer.

Add catalog definitions and server renderers together:

```ts
const renderers = {
  Notice: (fields, children, context) => '<aside>...</aside>',
}
pageComposerPlugin({ components: { Notice: { label: 'Notice', tab: 'Content', fields: [] } }, renderers })
// Pass the SAME renderers to PageComposerContent for public output.
```

Custom renderers are trusted application code and must escape/sanitize their own field values. Built-in renderers sanitize rich text and URLs, restrict style declarations, and do not execute stored `scripts`/`styles`. Unknown component types render their name and children rather than guessing a PHP/WordPress template. The first release does not translate WordPress/PHP templates, provide ecommerce components, or implement frontend editing of arbitrary array/block paths without an `onSave` adapter.

## Develop, test and release

```sh
npm ci
npm run build
npm test
npm pack
```

`npm pack` builds and tests before packaging. It includes runtime assets and declarations, not credentials or application data. To refresh the vendored editor from the sibling editor project, build that project first, then run `npm run sync:editor -- /absolute/path/to/editor`. Build the dedicated entry with `npm run build:payloadcms` in the private editor project. The sync script copies only `pceditor_payloadcms.js`, compiled CSS, notices and TinyMCE. Editor source and source maps are never included. `npm pack` audits this boundary before creating a release. WordPress bundles are separate.

Source and issue tracking are hosted at [sgorev/page-composer-payloadcms](https://github.com/sgorev/page-composer-payloadcms). Marketplace publication is separate from this GitHub repository.

### Settings value preservation (0.1.5)

Settings edits remain intact when searching fields or switching visible groups, including fields hidden by conditions. Standalone settings panels preserve complete values through change notifications and support reliable destroy/remount cleanup. The embedded editor was refreshed from the shared core release `2c2a876`; the Payload adapter remained unchanged.

### Content dragging and cursor (0.1.4)

Ordinary component content is draggable by default and shows a grab cursor, changing to grabbing during movement. Interactive controls are excluded automatically. Component definitions can set `dragFromContent: false`; template elements can use `data-pce-no-drag` to exclude a subtree. Rows drag only from their headers. Existing drag handles remain available.

Release 0.1.4 preserved the settings APIs and adapter shipped in 0.1.3 while updating only the shared dragging and cursor implementation. That release retained the Payload settings lifecycle extensions already present in 0.1.3.

### Column layout compatibility (0.1.3)

The embedded editor preserves its previous upward rounding for fractional column widths, including narrow custom layouts, while retaining the safe numeric parser. The compiled editor assets were refreshed from the private source project. Existing content needs no migration.

### Direct mounting (0.1.1)

`height` is now a minimum canvas height, rather than the height of a scrolling iframe. Content, field configuration and stored drafts need no migration. The adapter loads the editor bundle once, creates a separate root and request driver per field, synchronizes external value changes, and cleans up on navigation. Read-only state applies only to that canvas. Editor controls do not submit the enclosing Payload form. The media chooser, templates, renderer and document saves still use the current Payload session. TinyMCE may use its own internal rich-text iframe; the layout/drag canvas itself is ordinary page DOM.

The packaged stylesheet is generated by `scripts/scope-css.mjs`. Only the editor’s TinyMCE auxiliary dialogs and Page Composer SweetAlert dialogs retain their body-portal rules. Avoid putting a CSS transform, filter or containment that creates a fixed-position containing block on an ancestor of the editor: component dragging and dialogs use viewport coordinates.
