/* Direct DOM adapter. The core keeps its own React root; each field owns its state. */
(() => {
  const React = window.pce.React
  const h = React.createElement
  const info = doc => ({ file_id: doc.id, file_path: doc.url, file_type: doc.mimeType, file_name: doc.filename, alt: doc.alt || '' })
  function createDriver(settings, isLocked, failure) {
    const request = async (url, options = {}) => {
      const response = await fetch(url, { credentials: 'same-origin', ...options })
      const body = await response.json()
      if (!response.ok) { const error = new Error(body.errors?.[0]?.message || `Request failed (${response.status})`); failure(error); throw error }
      return body
    }
    const endpoint = slug => `${settings.apiURL}/${encodeURIComponent(slug)}`
    const info = doc => ({ file_id: doc.id, file_path: doc.url, file_type: doc.mimeType, file_name: doc.filename, alt: doc.alt || '' })
    const data = value => typeof value === 'string' ? JSON.parse(value) : value
    const write = async (slug, id, body) => {
      if (isLocked()) throw new Error('This editor is read-only.')
      return request(endpoint(slug) + (id ? `/${encodeURIComponent(id)}` : ''), { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    const all = async (slug, params = {}) => {
      let page = 1, docs = [], result
      do {
        result = await request(`${endpoint(slug)}?${new URLSearchParams({ limit: '100', depth: '0', page: String(page++), ...params })}`)
        docs.push(...result.docs)
      } while (result.hasNextPage)
      return docs
    }
    const driver = {
      name: 'payload-direct', requestMedia(params) { return request(`${endpoint(settings.media)}?${params}`) },
      async uploadFile(file, alt = file.name) {
        if (isLocked()) throw new Error('This editor is read-only.')
        const form = new FormData()
        form.append('file', file)
        form.append('_payload', JSON.stringify({ alt }))
        const result = await request(endpoint(settings.media), { method: 'POST', body: form })
        return info(result.doc)
      },
      async loadFile(id) { return info(await request(`${endpoint(settings.media)}/${encodeURIComponent(id)}`)) },
      async getComponents(tag, name) {
        const params = { sort: '-updatedAt' }
        if (tag) params['where[tag][equals]'] = tag
        if (name) params['where[name][contains]'] = name
        return (await all(settings.presets, params)).map(doc => ({ ...doc, json: JSON.stringify(doc.data), created_at: doc.createdAt }))
      },
      async saveComponent(value) { await write(settings.presets, value.id, { name: value.name, tag: value.tag, data: data(value.json) }); return true },
      async deleteComponent(id) {
        if (isLocked()) throw new Error('This editor is read-only.')
        await request(`${endpoint(settings.presets)}/${encodeURIComponent(id)}`, { method: 'DELETE' }); return true
      },
      async getTemplates() { return (await all(settings.templates, { sort: '-updatedAt' })).map(doc => ({ ...doc, json: JSON.stringify(doc.content || []) })) },
      async saveTemplate(value) { await write(settings.templates, value.id, { name: value.name, content: data(value.json) }); return true },
      async renderMode(args) { return request(`${settings.base}/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }) },
    }
    return driver
  }
  window.pce.register.driver({ name: 'payload-direct', init(config) { Object.assign(this, config.driver) } })


  // Keep this field on the editor's own React runtime; no cross-root hooks.
  class PayloadMedia extends React.Component {
    static rerenderAfterSettingValue = false
    constructor(props) {
      super(props)
      this.state = { value: props.value || null, docs: [], open: false, busy: false, search: '', page: 1, hasNext: false, error: '', alt: '' }
    }
    componentDidUpdate(previous) {
      if (previous.value !== this.props.value && this.props.value !== this.state.value) this.setState({ value: this.props.value || null })
    }
    choose(value) { this.setState({ value, open: false }); this.props.setValue(this.props.index, value) }
    async browse(page = 1) {
      this.setState({ busy: true, open: true, error: '' })
      try {
        const params = new URLSearchParams({ limit: '12', depth: '0', sort: '-createdAt', page: String(page), 'where[mimeType][contains]': 'image/' })
        if (this.state.search) params.set('where[filename][contains]', this.state.search)
        const result = await this.props.requests.driver().requestMedia(params)
        this.setState({ docs: result.docs, page, hasNext: result.hasNextPage })
      } catch (error) { this.setState({ error: error.message }) }
      finally { this.setState({ busy: false }) }
    }
    async upload(file) {
      if (!file) return
      this.setState({ busy: true, error: '' })
      try { this.choose(await this.props.requests.driver().uploadFile(file, this.state.alt || file.name)) }
      catch (error) { this.setState({ error: error.message }) }
      finally { this.setState({ busy: false }) }
    }
    render() {
      const v = this.state.value
      return h('div', { className: 'field pc-media-field' },
        h('label', null, this.props.label),
        v?.file_path && h('img', { src: v.file_path, alt: v.alt || '', style: { maxWidth: '100%', maxHeight: 180, objectFit: 'contain' } }),
        v && h('p', null, v.file_name),
        h('label', null, 'Alternative text for upload', h('input', { type: 'text', value: this.state.alt, onChange: e => this.setState({ alt: e.target.value }) })),
        h('input', { type: 'file', accept: 'image/*', disabled: this.state.busy, 'aria-label': 'Upload image', onChange: e => this.upload(e.target.files[0]) }),
        h('button', { type: 'button', disabled: this.state.busy, onClick: () => this.browse() }, 'Choose from Media'),
        v && h('button', { type: 'button', onClick: () => this.choose(null) }, 'Remove image'),
        this.state.busy && h('p', { role: 'status' }, 'Loading…'),
        this.state.error && h('p', { role: 'alert' }, this.state.error),
        this.state.open && h('div', { className: 'pc-media-browser' },
          h('input', { type: 'search', 'aria-label': 'Search media', placeholder: 'Search filename', value: this.state.search, onChange: e => this.setState({ search: e.target.value }) }),
          h('button', { type: 'button', onClick: () => this.browse() }, 'Search'),
          h('div', { className: 'pc-media-grid' }, this.state.docs.map(doc => h('button', { type: 'button', key: doc.id, onClick: () => this.choose(info(doc)) }, h('img', { src: doc.url, alt: doc.alt || '' }), h('span', null, doc.filename)))),
          !this.state.docs.length && h('p', null, 'No images found. Upload an image above.'),
          h('button', { type: 'button', disabled: this.state.page <= 1, onClick: () => this.browse(this.state.page - 1) }, 'Previous'),
          h('button', { type: 'button', disabled: !this.state.hasNext, onClick: () => this.browse(this.state.page + 1) }, 'Next'),
          h('button', { type: 'button', onClick: () => this.setState({ open: false }) }, 'Close library'),
        ),
      )
    }
  }
  window.pce.register.field('payload-media', PayloadMedia)
  // "Save" in the core editor saves a reusable template, not the CMS document.
  window.pce.langs.en.saveButton = () => 'Save template'

  // Cached HTML may be mounted more than once. Give each actual DOM instance
  // its own namespace, including section controls and their CSS references.
  let liveSequence = 0
  function isolateLiveMarkup({ node }) {
    if (!node) return
    for (const wrapper of node.querySelectorAll('[data-pc-live]')) {
      if (wrapper.dataset.pcLiveMounted) continue
      const previous = wrapper.dataset.pcLive
      if (!/^pc-live-[a-z0-9-]+$/i.test(previous)) continue
      const next = `${previous}-instance-${++liveSequence}`
      const replace = value => value.split(previous).join(next)
      const owned = [wrapper, ...wrapper.querySelectorAll('*')].filter(element => element.closest('[data-pc-live]') === wrapper)
      for (const element of owned) {
        for (const attribute of ['id', 'for', 'name', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'href']) {
          const value = element.getAttribute(attribute)
          if (value && value.includes(previous)) element.setAttribute(attribute, replace(value))
        }
        if (element.tagName === 'STYLE') element.textContent = replace(element.textContent)
      }
      wrapper.dataset.pcLiveMounted = 'true'
    }
  }

  let sequence = 0
  window.PageComposerPayload = {
    mountSettings(root, settings, options) {
      const surface = root.parentElement
      root.id = `payload-composer-settings-${++sequence}`
      let handle, current, locked = false, disposed = false
      const failure = error => { if (!disposed) options.onError(error.message || String(error)) }
      const driver = createDriver(settings, () => locked || disposed, failure)
      const click = event => {
        const button = event.target.closest('button')
        if (button && surface.contains(button) && button.type === 'submit') event.preventDefault()
      }
      const keydown = event => {
        if (event.key === 'Enter' && event.target.matches('input:not([type=button]):not([type=submit])')) event.preventDefault()
      }
      surface.addEventListener('click', click)
      surface.addEventListener('keydown', keydown)
      const controller = {
        update({ value = {}, readOnly = false }) {
          if (disposed) return
          locked = Boolean(readOnly)
          surface.inert = locked
          surface.classList.toggle('pc-readonly', locked)
          const serialized = JSON.stringify(value)
          if (handle && serialized === current) return
          handle?.destroy()
          current = serialized
          handle = window.pcEditorSettingsFields(root, {
            fields: settings.catalog[options.tag].fields || [],
            licenseToken: settings.licenseToken,
            componentTag: options.tag, componentName: settings.catalog[options.tag].label || options.tag,
            requests: { driver: 'payload-direct', config: { driver } }, lang: 'en',
            onChange(next) {
              if (disposed || locked) return
              current = JSON.stringify(next)
              options.onChange(next)
            },
          }, value)
        },
        destroy() {
          if (disposed) return
          disposed = true
          surface.removeEventListener('click', click)
          surface.removeEventListener('keydown', keydown)
          surface.inert = false
          surface.classList.remove('pc-readonly')
          const previous = handle
          queueMicrotask(() => { previous?.destroy(); root.remove() })
        },
      }
      controller.update(options)
      return controller
    },
    mount(root, settings, options) {
      const surface = root.parentElement
      root.id = `payload-composer-${++sequence}`
      let handle, current = '[]', mode, locked = false, mounting = false, generation = 0, disposed = false
      const failure = error => { if (!disposed) options.onError(error.message || String(error)) }
      const driver = createDriver(settings, () => locked || disposed, failure)
      const renderCacheKey = `${root.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      function mount(value, nextMode) {
        mounting = true
        const revision = ++generation
        if (handle) handle.destroy()
        current = JSON.stringify(value)
        mode = nextMode
        root.setAttribute('data-content', current)
        handle = window.pcEditor(root, { mode, events: { liveRender: isolateLiveMarkup }, licenseToken: settings.licenseToken, components: settings.catalog, requests: { driver: 'payload-direct', config: { driver, renderCacheKey } }, lang: 'en' })
        const finishMount = decision => {
          if (disposed || generation !== revision) return
          if (decision && !decision.ok) failure(new Error(decision.message))
          requestAnimationFrame(() => requestAnimationFrame(() => { if (!disposed && generation === revision) mounting = false }))
        }
        if (handle.ready) handle.ready.then(finishMount)
        else finishMount()
      }
      const change = event => {
        if (disposed || mounting || locked || event.target.dataset.pceEditor !== root.id) return
        try {
          const next = event.target.value || '[]'
          if (next === current) return
          const value = JSON.parse(next)
          current = next
          options.onChange(value)
        } catch (error) { failure(error) }
      }
      // Core controls live inside Payload's form. Never let their default HTML
      // submit action save the CMS document, including Enter in a text field.
      const click = event => {
        const button = event.target.closest('button')
        if (button && surface.contains(button) && button.type === 'submit') event.preventDefault()
      }
      const keydown = event => {
        if (event.key === 'Enter' && event.target.matches('input:not([type=button]):not([type=submit])')) event.preventDefault()
      }
      surface.addEventListener('change', change)
      surface.addEventListener('click', click)
      surface.addEventListener('keydown', keydown)
      const controller = {
        update({ value = [], mode: nextMode = 'widget', readOnly = false }) {
          if (disposed) return
          if (!Array.isArray(value)) { failure(new Error('Invalid content: expected a component array.')); return }
          locked = Boolean(readOnly)
          surface.inert = locked
          surface.classList.toggle('pc-readonly', locked)
          if (!handle || JSON.stringify(value) !== current || mode !== nextMode) mount(value, nextMode)
        },
        destroy() {
          if (disposed) return
          disposed = true
          ++generation
          surface.removeEventListener('change', change)
          surface.removeEventListener('click', click)
          surface.removeEventListener('keydown', keydown)
          surface.inert = false
          surface.classList.remove('pc-readonly')
          // Defer the nested React root's unmount until the host's commit ends.
          // The client supplies a distinct root on every mount (Strict Mode too).
          const previous = handle
          queueMicrotask(() => { previous?.destroy(); root.remove() })
        },
      }
      controller.update(options)
      return controller
    },
  }
})()
