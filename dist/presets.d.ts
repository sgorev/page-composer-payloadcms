/** Bridge the settings API's flat values and the full nodes stored by presets. */
export type PresetField = {
    name: string;
    type?: string;
    value?: unknown;
    [key: string]: unknown;
};
export type PresetNode = {
    fields?: PresetField[];
    components?: PresetNode[];
    [key: string]: unknown;
};
export type ComponentDefinition = {
    fields?: PresetField[];
    label?: string;
    template?: string;
    [key: string]: unknown;
};
export declare function presetValues(node: PresetNode | null | undefined, definition: ComponentDefinition): Record<string, unknown>;
export declare function mergePresetValues(node: PresetNode | null | undefined, tag: string, definition: ComponentDefinition, values: Record<string, unknown>): PresetNode;
