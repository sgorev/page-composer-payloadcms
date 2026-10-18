export type ComposerNode = {
  name: string
  template?: string
  type?: string
  value?: unknown
  col?: string
  cols?: unknown
  fields?: ComposerNode[]
  components?: ComposerNode[]
  styles?: string
  scripts?: string
}
export type ComposerContent = ComposerNode[]

/** Validate shape without discarding future/custom component fields. */
export function validateContent(value: unknown, required = false): true | string {
  if (value == null) return required ? 'Content is required.' : true
  if (!Array.isArray(value)) return 'Page Composer content must be an array of components.'
  if (required && value.length === 0) return 'Add at least one content component.'
  if (JSON.stringify(value).length > 2_000_000) return 'Content exceeds the 2 MB limit.'
  let count = 0
  function check(nodes: unknown[], depth: number): boolean {
    if (depth > 32) return false
    return nodes.every((node) => {
      if (++count > 10000 || !node || typeof node !== 'object' || Array.isArray(node)) return false
      const n = node as ComposerNode
      if (typeof n.name !== 'string' || !n.name || n.name.length > 200) return false
      return ['components', 'fields'].every((key) => {
        const children = n[key as 'components' | 'fields']
        return children === undefined || (Array.isArray(children) && check(children, depth + 1))
      })
    })
  }
  return check(value, 0) || 'Invalid Page Composer tree (components/fields, depth, or size).'
}
