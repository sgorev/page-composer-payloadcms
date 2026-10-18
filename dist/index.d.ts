import type { Access, JSONField, Plugin } from 'payload';
import { type Renderers } from './render.js';
export { validateContent } from './content.js';
export type { ComposerContent, ComposerNode } from './content.js';
export type { Renderers, ComponentRenderer } from './render.js';
export type PageComposerFieldOptions = Omit<JSONField, 'type'> & {
    mode?: 'widget' | 'live';
    height?: number;
};
/** Add to any collection, global, group, tab, array or block's fields. */
export declare function pageComposerField(options: PageComposerFieldOptions): JSONField;
export type PageComposerPluginOptions = {
    /** Purchased Payload CMS product key. Keep it in a server-only environment variable. */
    apiKey?: string;
    /** Override only for a development licensing backend. */
    licenseVerifyURL?: string;
    mediaCollection?: string;
    templatesCollection?: string;
    presetsCollection?: string;
    /** Defaults to authenticated users of config.admin.user. */
    access?: Access;
    /** Merge extra component definitions into the default catalog. */
    components?: Record<string, Record<string, unknown>>;
    renderers?: Renderers;
    /** Add a content field to selected collections without modifying their definitions. */
    collections?: Record<string, false | Omit<PageComposerFieldOptions, 'name'> & {
        name?: string;
    }>;
    globals?: Record<string, false | Omit<PageComposerFieldOptions, 'name'> & {
        name?: string;
    }>;
};
export declare function pageComposerPlugin(options?: PageComposerPluginOptions): Plugin;
