import React from 'react';
import { type ComposerContent, type ComposerNode } from './content.js';
export declare const escapeHTML: (value: unknown) => string;
export declare function cleanHTML(value: unknown): string;
export declare function componentStyle(node: ComposerNode, id: string): string;
export type RenderContext = {
    id: string;
    live: boolean;
    children: ComposerNode[];
};
export type ComponentRenderer = (fields: Record<string, unknown>, children: string, context: RenderContext) => string;
export type Renderers = Record<string, ComponentRenderer>;
export declare const contentCSS = ".pc-content{font:16px/1.6 system-ui,sans-serif;color:inherit;overflow-wrap:anywhere}.pc-content *{box-sizing:border-box}.pc-content h1,.pc-content h2,.pc-content h3,.pc-content h4{line-height:1.2;margin:.5em 0}.pc-content p{margin:.7em 0}.pc-content figure{margin:0}.pc-content img{max-width:100%;height:auto;display:block}.pc-content figcaption{font-size:.875em;opacity:.75}.pc-row{display:flex;flex-wrap:wrap;gap:0}.pc-row>.pc-node{width:var(--pc-width,100%);padding:8px}.pc-content .pc-button{display:inline-block;padding:10px 22px;background:#3544d4;color:white;border-radius:6px;text-decoration:none}.pc-content details{padding:12px;border:1px solid #ddd;border-radius:6px;margin:8px 0}.pc-content summary{cursor:pointer;font-weight:600}.pc-tabs,.pc-accordion-section{position:relative}.pc-section-state{position:absolute;opacity:0;pointer-events:none}.pc-tab-labels{display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid #ddd}.pc-tab-labels>span,.pc-section-heading{display:flex;align-items:center;gap:8px}.pc-tab-labels label{padding:8px 12px;border-bottom:2px solid transparent;cursor:pointer}.pc-tab-panel,.pc-section-body{display:none;padding:12px}.pc-accordion-section{border:1px solid #ddd;border-radius:6px;margin:8px 0}.pc-section-heading{padding:12px}.pc-section-heading label{cursor:pointer;flex:1;font-weight:600}.pc-section-state:checked~.pc-section-body{display:block}.pc-section-state:focus-visible~.pc-section-heading label,.pc-section-state:focus-visible~.pc-tab-labels{outline:2px solid #3544d4}.pc-placeholder{padding:30px;background:#eee;text-align:center;color:#555}@media(max-width:640px){.pc-row>.pc-node{width:100%}}";
export declare function renderContent(value: ComposerContent | null | undefined, options?: {
    id?: string;
    renderers?: Renderers;
}): string;
export declare function renderLiveComponent(args: ComposerNode & {
    index?: string;
    children?: ComposerNode[];
}, renderers?: Renderers): {
    html: string;
    class: string;
};
/** Server component: does not ship the editor to public visitors. */
export declare function PageComposerContent({ value, id, renderers }: {
    value?: ComposerContent | null;
    id?: string;
    renderers?: Renderers;
}): React.JSX.Element;
