import { jsx as _jsx } from "react/jsx-runtime";
import sanitizeHtml from 'sanitize-html';
import { parse as parseFlatted } from 'flatted';
import { validateContent } from './content.js';
export const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeURL = (value) => {
    const url = String(value ?? '').trim();
    return /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(url) ? escapeHTML(url) : '';
};
export function cleanHTML(value) {
    return sanitizeHtml(String(value ?? ''), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['style'], img: ['src', 'alt', 'width', 'height'] },
        allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/], color: [/^#[0-9a-f]+$/i, /^[a-z]+$/i], 'font-weight': [/^(normal|bold|[1-9]00)$/] } },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'], allowProtocolRelative: false,
    });
}
function decode(value) {
    if (typeof value !== 'string')
        return value;
    try {
        return parseFlatted(value);
    }
    catch {
        return value;
    }
}
function fields(node) {
    return Object.fromEntries((node.fields || []).map(f => [f.name, decode(f.value)]));
}
function declarations(value) {
    if (!value || typeof value !== 'object')
        return '';
    const obj = value;
    const props = (obj.css && typeof obj.css === 'object' ? obj.css : obj);
    return Object.entries(props).filter(([key, val]) => /^[a-z][a-z-]*$/.test(key) && !['behavior', 'position', 'z-index'].includes(key) &&
        (typeof val === 'string' || typeof val === 'number') && !/[{}<>;\\]|url\s*\(|expression\s*\(|@/i.test(String(val))).map(([key, val]) => `${key}:${String(val)}`).join(';');
}
export function componentStyle(node, id) {
    const raw = fields(node).css_props;
    if (!raw || typeof raw !== 'object')
        return '';
    const v = raw;
    const rule = (value) => { const css = declarations(value); return css ? `#${id}{${css}}` : ''; };
    return rule(v.desktop || v) + (v.tablet ? `@media(max-width:1024px){${rule(v.tablet)}}` : '') + (v.mobile ? `@media(max-width:640px){${rule(v.mobile)}}` : '');
}
function componentHTML(node, childrenHTML, context, renderers) {
    const f = fields(node);
    const slot = context.live ? '<div data-components></div>' : childrenHTML.join('');
    if (renderers[node.name])
        return renderers[node.name](f, slot, context);
    switch (node.name) {
        case 'Row': return `<div class="pc-row">${slot}</div>`;
        case 'Col':
        case 'Container': return `<div>${slot}</div>`;
        case 'Title': {
            const tag = /^h[1-6]$/.test(String(f.level)) ? String(f.level) : 'h2';
            return `<${tag}>${escapeHTML(f.title || '')}</${tag}>`;
        }
        case 'Text': return `<div class="pc-richtext">${cleanHTML(f.text)}</div>`;
        case 'Image': {
            const image = (Array.isArray(f.image) ? f.image[0] : f.image);
            const src = safeURL(image?.file_path);
            return src ? `<figure><img src="${src}" alt="${escapeHTML(f.alt || image?.alt || '')}"/>${f.caption ? `<figcaption>${escapeHTML(f.caption)}</figcaption>` : ''}</figure>` : '<div class="pc-placeholder">Select an image</div>';
        }
        case 'Button': return `<a class="pc-button" href="${safeURL(f.url) || '#'}">${escapeHTML(f.label || 'Button')}</a>`;
        case 'Spacer': return `<div style="height:${Math.max(0, Math.min(1000, Number(f.height) || 32))}px" aria-hidden="true"></div>`;
        case 'Accordion':
        case 'Tabs': {
            const sections = (context.children.length ? context.children : [{ name: 'Col', value: { name: 'Section 1' } }]).map((child, i) => {
                const meta = (child.value || {});
                return { title: escapeHTML(meta.name || `Section ${i + 1}`), open: meta.open !== false, active: Boolean(meta.active),
                    content: context.live ? '<div data-components></div>' : (childrenHTML[i] || '') };
            });
            const title = (text, i) => context.live ? `<span data-live-sec-title="${i}" title="Double-click to rename">${text}</span>` : text;
            const controls = (i) => context.live ? `<span data-live-sec-controls="${i}"${node.name === 'Tabs' ? ' data-axis="x"' : ''}></span>` : '';
            const add = context.live ? '<span data-live-add-section></span>' : '';
            if (node.name === 'Accordion')
                return `<div class="pc-accordion">${sections.map((s, i) => {
                    const id = `${context.id}-section-${i}`;
                    return `<section class="pc-accordion-section"><input class="pc-section-state" type="checkbox" id="${id}"${s.open ? ' checked' : ''}/><div class="pc-section-heading"><label for="${id}">${title(s.title, i)}</label>${controls(i)}</div><div class="pc-section-body">${s.content}</div></section>`;
                }).join('')}${add}</div>`;
            const active = Math.max(0, sections.findIndex(s => s.active));
            const css = sections.map((s, i) => `#${context.id}-tab-${i}:checked~.pc-tab-panels>.pc-tab-panel-${i}{display:block}#${context.id}-tab-${i}:checked~.pc-tab-labels label[for="${context.id}-tab-${i}"]{border-bottom-color:#3544d4}`).join('');
            return `<div class="pc-tabs"><style>${css}</style>${sections.map((s, i) => `<input class="pc-section-state" type="radio" name="${context.id}-tabs" id="${context.id}-tab-${i}"${i === active ? ' checked' : ''}/>`).join('')}<div class="pc-tab-labels">${sections.map((s, i) => `<span><label for="${context.id}-tab-${i}">${title(s.title, i)}</label>${controls(i)}</span>`).join('')}${add}</div><div class="pc-tab-panels">${sections.map((s, i) => `<div class="pc-tab-panel pc-tab-panel-${i}">${s.content}</div>`).join('')}</div></div>`;
        }
        default: return `<div class="pc-unknown">${escapeHTML(node.name)}${slot}</div>`;
    }
}
export const contentCSS = `.pc-content{font:16px/1.6 system-ui,sans-serif;color:inherit;overflow-wrap:anywhere}.pc-content *{box-sizing:border-box}.pc-content h1,.pc-content h2,.pc-content h3,.pc-content h4{line-height:1.2;margin:.5em 0}.pc-content p{margin:.7em 0}.pc-content figure{margin:0}.pc-content img{max-width:100%;height:auto;display:block}.pc-content figcaption{font-size:.875em;opacity:.75}.pc-row{display:flex;flex-wrap:wrap;gap:0}.pc-row>.pc-node{width:var(--pc-width,100%);padding:8px}.pc-content .pc-button{display:inline-block;padding:10px 22px;background:#3544d4;color:white;border-radius:6px;text-decoration:none}.pc-content details{padding:12px;border:1px solid #ddd;border-radius:6px;margin:8px 0}.pc-content summary{cursor:pointer;font-weight:600}.pc-tabs,.pc-accordion-section{position:relative}.pc-section-state{position:absolute;opacity:0;pointer-events:none}.pc-tab-labels{display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid #ddd}.pc-tab-labels>span,.pc-section-heading{display:flex;align-items:center;gap:8px}.pc-tab-labels label{padding:8px 12px;border-bottom:2px solid transparent;cursor:pointer}.pc-tab-panel,.pc-section-body{display:none;padding:12px}.pc-accordion-section{border:1px solid #ddd;border-radius:6px;margin:8px 0}.pc-section-heading{padding:12px}.pc-section-heading label{cursor:pointer;flex:1;font-weight:600}.pc-section-state:checked~.pc-section-body{display:block}.pc-section-state:focus-visible~.pc-section-heading label,.pc-section-state:focus-visible~.pc-tab-labels{outline:2px solid #3544d4}.pc-placeholder{padding:30px;background:#eee;text-align:center;color:#555}@media(max-width:640px){.pc-row>.pc-node{width:100%}}`;
export function renderContent(value, options = {}) {
    const validation = validateContent(value);
    if (validation !== true)
        throw new Error(validation);
    const prefix = (options.id || 'pc-content').replace(/[^a-z0-9_-]/gi, '-');
    const renderers = options.renderers || {};
    let styles = '';
    function render(nodes, parent) {
        return nodes.map((node, i) => {
            const id = `${parent}-${i}`;
            const children = node.components || [];
            styles += componentStyle(node, id);
            const col = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(node.col || '') ? node.col.split('/').map(Number) : [12, 12];
            const width = Math.max(0, Math.min(100, col[0] / (col[1] || 12) * 100));
            return `<div class="pc-node" id="${id}" style="--pc-width:${width}%">${componentHTML(node, render(children, id), { id, live: false, children }, renderers)}</div>`;
        });
    }
    const html = render(value || [], prefix).join('');
    return `<style>${contentCSS}${styles}</style><div class="pc-content">${html}</div>`;
}
export function renderLiveComponent(args, renderers = {}) {
    const id = `pc-live-${String(args.index || '0').replace(/[^a-z0-9_-]/gi, '-')}`;
    const html = componentHTML(args, [], { id, live: true, children: args.children || [] }, renderers);
    return { html: `<style>${componentStyle(args, id)}</style><div class="pc-content" id="${id}">${html}</div>`, class: '' };
}
/** Server component: does not ship the editor to public visitors. */
export function PageComposerContent({ value, id, renderers }) {
    return _jsx("div", { dangerouslySetInnerHTML: { __html: renderContent(value, { id, renderers }) } });
}
