const css = () => ({
    type: 'css', name: 'css_props', label: 'Style', group: 'Style',
    tabs: [{ label: 'Desktop', slug: 'desktop' }, { label: 'Tablet', slug: 'tablet' }, { label: 'Mobile', slug: 'mobile' }],
});
export function createCatalog(assetURL) {
    return {
        Row: { tab: 'Layout', label: 'Row', fields: [{ type: 'cols', name: 'cols', label: 'Columns', group: 'Layout' }, css()] },
        Col: { fields: [css()] },
        Container: { tab: 'Layout', label: 'Container', template: 'container', fields: [css()] },
        Title: { tab: 'Content', label: 'Heading', template: 'text', fields: [
                { type: 'text', name: 'title', label: 'Heading', group: 'Content', show_in_template: true },
                { type: 'select', name: 'level', label: 'Heading level', group: 'Content', value: 'h2', params: [{ h1: 'H1' }, { h2: 'H2' }, { h3: 'H3' }, { h4: 'H4' }] }, css(),
            ] },
        Text: { tab: 'Content', label: 'Rich text', template: 'text', fields: [
                { type: 'wysiwyg', name: 'text', label: 'Text', group: 'Content', show_in_template: true,
                    config: { tinymce: { script_src: `${assetURL}/tinymce/tinymce.min.js`, init: { plugins: 'link image code lists', toolbar: 'undo redo | blocks | bold italic | bullist numlist | link | code' } } } }, css(),
            ] },
        Image: { tab: 'Content', label: 'Image', template: 'image', fields: [
                { type: 'payload-media', name: 'image', label: 'Image', group: 'Content', show_in_template: true },
                { type: 'text', name: 'alt', label: 'Alternative text', group: 'Content' },
                { type: 'text', name: 'caption', label: 'Caption', group: 'Content' }, css(),
            ] },
        Button: { tab: 'Content', label: 'Button', template: 'fields_inline', fields: [
                { type: 'text', name: 'label', label: 'Label', group: 'Content', show_in_template: true },
                { type: 'text', name: 'url', label: 'Link URL', group: 'Content' }, css(),
            ] },
        Spacer: { tab: 'Layout', label: 'Spacer', template: 'fields_inline', fields: [
                { type: 'text', name: 'height', label: 'Height (px)', value: '32', group: 'Layout', show_in_template: true }, css(),
            ] },
        Accordion: { tab: 'Layout', label: 'Accordion', template: 'accordion', fields: [css()] },
        Tabs: { tab: 'Layout', label: 'Tabs', template: 'tabs', fields: [css()] },
    };
}
