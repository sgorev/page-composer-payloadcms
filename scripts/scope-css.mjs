import postcss from 'postcss'

/** Scope the legacy stylesheet without changing keyframe selectors or percentages. */
export function scopeEditorCSS(css) {
  const root = postcss.parse(css)
  root.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return
    rule.selectors = rule.selectors.map(selector => {
      // SweetAlert portals are outside the canvas and need the same theme tokens.
      if (selector === ':root') return '.page-composer-surface, .swal2-popup.pce-swal'
      // TinyMCE and SweetAlert place their dialogs under document.body.
      if (selector.startsWith('.tox.')) return selector
      if (selector === '.swal2-container') return '.swal2-container:has(.pce-swal)'
      if (selector.includes('.pce-swal')) return selector
      if (selector.startsWith('body')) {
        // Drag state is set on body by the core, but its effects stay in a canvas.
        const boundary = selector.indexOf(' ')
        return boundary < 0 ? `${selector} .page-composer-surface` : `${selector.slice(0, boundary)} .page-composer-surface${selector.slice(boundary)}`
      }
      return `.page-composer-surface ${selector}`
    })
  })
  return root.toString()
}
