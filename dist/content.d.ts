export type ComposerNode = {
    name: string;
    template?: string;
    type?: string;
    value?: unknown;
    col?: string;
    cols?: unknown;
    fields?: ComposerNode[];
    components?: ComposerNode[];
    styles?: string;
    scripts?: string;
};
export type ComposerContent = ComposerNode[];
/** Validate shape without discarding future/custom component fields. */
export declare function validateContent(value: unknown, required?: boolean): true | string;
